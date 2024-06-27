# python-backend/app.py
import builtins
import json
import textwrap
import time
from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS
import requests
import openai
from openai import Client
import os
from typing import List
from openai.types.beta.function_tool_param import FunctionToolParam
from openai.types.beta.threads import Message, MessageDelta
from openai.types.beta.threads.runs import ToolCall
from openai.types.beta.threads.runs import RunStep
from openai.types.beta.threads.runs import FunctionToolCallDelta
from openai.types.beta.assistant_stream_event import AssistantStreamEvent

from pydantic import Field
from instructor import OpenAISchema

from dotenv import load_dotenv

from typing_extensions import override
from openai import AssistantEventHandler


class GetUserMission(OpenAISchema):
    """Get the user's mission as well as their history of daily todo list items and progress."""
    user_id: int = Field(
        ...,
        description=
        "The id of the user that we want to get information for - information such as the user's mission and todo list items."
    )

    def run(self):
        response = requests.get(
            f'http://localhost:8080/api/user-mission?user_id={self.user_id}')
        if response.status_code != 200:
            return f"Error: Failed to fetch latest thread ID, Status Code: {response.status_code}"
        else:
            return json.dumps(response.json())


def wprint(*args, width=70, **kwargs):
    """
    Custom print function that wraps text to a specified width.

    Args:
    *args: Variable length argument list.
    width (int): The maximum width of wrapped lines.
    **kwargs: Arbitrary keyword arguments.
    """
    wrapper = textwrap.TextWrapper(width=width)

    # Process all arguments to make sure they are strings and wrap them
    wrapped_args = [wrapper.fill(str(arg)) for arg in args]

    # Call the built-in print function with the wrapped text
    builtins.print(*wrapped_args, **kwargs)


# makes new openai assistants api look like old completions api
def get_completion(client, message, agent, funcs, thread):
    """
    Executes a thread based on a provided message and retrieves the completion result.

    This function submits a message to a specified thread, triggering the execution of an array of functions
    defined within a func parameter. Each function in the array must implement a `run()` method that returns the outputs.

    Parameters:
    - message (str): The input message to be processed.
    - agent (OpenAI Assistant): The agent instance that will process the message.
    - funcs (list): A list of function objects, defined with the instructor library.
    - thread (Thread): The OpenAI Assistants API thread responsible for managing the execution flow.

    Returns:
    - str: The completion output as a string, obtained from the agent following the execution of input message and functions.
    """

    # create new message in the thread
    message = client.beta.threads.messages.create(thread_id=thread.id,
                                                  role="user",
                                                  content=message)

    # run this thread
    run = client.beta.threads.runs.create(
        thread_id=thread.id,
        assistant_id=agent.id,
    )

    while True:
        # wait until run completes
        while run.status in ['queued', 'in_progress']:
            run = client.beta.threads.runs.retrieve(thread_id=thread.id,
                                                    run_id=run.id)
            time.sleep(1)

        # function execution
        if run.status == "requires_action":
            tool_calls = run.required_action.submit_tool_outputs.tool_calls
            tool_outputs = []
            for tool_call in tool_calls:
                wprint('\033[31m' + str(tool_call.function), '\033[0m')
                # find the tool to be executed
                func = next(
                    iter([
                        func for func in funcs
                        if func.__name__ == tool_call.function.name
                    ]))

                try:
                    # init tool
                    func = func(**eval(tool_call.function.arguments))
                    # get outputs from the tool
                    output = func.run()
                except Exception as e:
                    output = "Error: " + str(e)

                wprint(f"\033[33m{tool_call.function.name}: ", output,
                       '\033[0m')
                tool_outputs.append({
                    "tool_call_id": tool_call.id,
                    "output": output
                })

            # submit tool outputs
            run = client.beta.threads.runs.submit_tool_outputs(
                thread_id=thread.id, run_id=run.id, tool_outputs=tool_outputs)
        # error
        elif run.status == "failed":
            raise Exception("Run Failed. Error: ", run.last_error)
        # return assistant message
        else:
            messages = client.beta.threads.messages.list(thread_id=thread.id)
            message = messages.data[0].content[0].text.value
            return message


def get_completion_stream(client, message, agent, funcs, thread):
    # create new message in the thread
    message = client.beta.threads.messages.create(thread_id=thread.id,
                                                  role="user",
                                                  content=message)

    # First, we create a EventHandler class to define
    # how we want to handle the events in the response stream.

    class EventHandler(AssistantEventHandler):

        def __init__(self, thread_id, assistant_id):
            super().__init__()
            self.output = None
            self.tool_id = None
            self.thread_id = thread_id
            self.assistant_id = assistant_id
            self.run_id = None
            self.run_step: RunStep | None = None
            self.function_name = ""
            self.arguments = ""

        @override
        def on_text_created(self, text) -> None:
            print(f"\nassistant on_text_created > ", end="", flush=True)

        @override
        def on_text_delta(self, delta, snapshot):
            print(f"\nassistant on_text_delta > {delta.value}",
                  end="",
                  flush=True)

        @override
        def on_end(self, ):
            print(f"\n end assistant > ",
                  self.current_run_step_snapshot,
                  end="",
                  flush=True)

        @override
        def on_exception(self, exception: Exception) -> None:
            """Fired whenever an exception happens during streaming"""
            print(f"\nassistant > {exception}\n", end="", flush=True)

        @override
        def on_message_created(self, message: Message) -> None:
            print(f"\nassistant on_message_created > {message}\n",
                  end="",
                  flush=True)

        @override
        def on_message_done(self, message: Message) -> None:
            print(f"\nassistant on_message_done > {message}\n",
                  end="",
                  flush=True)

        @override
        def on_message_delta(self, delta: MessageDelta,
                             snapshot: Message) -> None:
            # print(f"\nassistant on_message_delta > {delta}\n", end="", flush=True)
            pass

        def on_tool_call_created(self, tool_call: ToolCall):
            # 4
            print(f"\nassistant on_tool_call_created > {tool_call}")
            self.function_name = tool_call.function.name
            self.tool_id = tool_call.id
            print(
                f"\on_tool_call_created > run_step.status > {self.run_step.status}"
            )

            print(f"\nassistant > {tool_call.type} {self.function_name}\n",
                  flush=True)

            keep_retrieving_run = client.beta.threads.runs.retrieve(
                thread_id=self.thread_id, run_id=self.run_id)

            while keep_retrieving_run.status in ["queued", "in_progress"]:
                keep_retrieving_run = client.beta.threads.runs.retrieve(
                    thread_id=self.thread_id, run_id=self.run_id)

                print(f"\nSTATUS: {keep_retrieving_run.status}")

        @override
        def on_tool_call_done(self, tool_call: ToolCall) -> None:
            keep_retrieving_run = client.beta.threads.runs.retrieve(
                thread_id=self.thread_id, run_id=self.run_id)

            print(f"\nDONE STATUS: {keep_retrieving_run.status}")

            if keep_retrieving_run.status == "completed":
                all_messages = client.beta.threads.messages.list(
                    thread_id=self.thread_id)

                print(all_messages.data[0].content[0].text.value, "", "")
                return

            elif keep_retrieving_run.status == "requires_action":
                print("here you would call your function")

                #function_data = my_example_funtion()
                # find the tool to be executed
                func = next(
                    iter([
                        func for func in funcs
                        if func.__name__ == self.function_name
                    ]))

                try:
                    # init tool
                    func = func(**eval(tool_call.function.arguments))
                    # get outputs from the tool
                    self.output = func.run()
                except Exception as e:
                    self.output = "Error: " + str(e)

                #self.output=function_data

                with client.beta.threads.runs.submit_tool_outputs_stream(
                        thread_id=self.thread_id,
                        run_id=self.run_id,
                        tool_outputs=[{
                            "tool_call_id": self.tool_id,
                            "output": self.output,
                        }],
                        event_handler=EventHandler(
                            self.thread_id, self.assistant_id)) as stream:
                    stream.until_done()

        @override
        def on_run_step_created(self, run_step: RunStep) -> None:
            # 2
            print(f"on_run_step_created")
            self.run_id = run_step.run_id
            self.run_step = run_step
            print("The type ofrun_step run step is ",
                  type(run_step),
                  flush=True)
            print(f"\n run step created assistant > {run_step}\n", flush=True)

        @override
        def on_run_step_done(self, run_step: RunStep) -> None:
            print(f"\n run step done assistant > {run_step}\n", flush=True)

        def on_tool_call_delta(self, delta, snapshot):
            if delta.type == 'function':
                # the arguments stream thorugh here and then you get the requires action event
                print(delta.function.arguments, end="", flush=True)
                self.arguments += delta.function.arguments
            elif delta.type == 'code_interpreter':
                print(f"on_tool_call_delta > code_interpreter")
                if delta.code_interpreter.input:
                    print(delta.code_interpreter.input, end="", flush=True)
                if delta.code_interpreter.outputs:
                    print(f"\n\noutput >", flush=True)
                    for output in delta.code_interpreter.outputs:
                        if output.type == "logs":
                            print(f"\n{output.logs}", flush=True)
            else:
                print("ELSE")
                print(delta, end="", flush=True)

        @override
        def on_event(self, event: AssistantStreamEvent) -> None:
            # print("In on_event of event is ", event.event, flush=True)

            if event.event == "thread.run.requires_action":
                print("\nthread.run.requires_action > submit tool call")
                print(f"ARGS: {self.arguments}")


# Then, we use the `stream` SDK helper
# with the `EventHandler` class to create the Run
# and stream the response.

# run this thread

    with client.beta.threads.runs.stream(
            thread_id=thread.id,
            assistant_id=agent.id,
            event_handler=EventHandler(thread_id=thread.id,
                                       assistant_id=agent.id),
    ) as stream:
        stream.until_done()
"""
    yield "Starting stream...\n"
    time.sleep(3)
    yield "Encouraging message...\n"
    time.sleep(2)
    yield "Todo history...\n"
    time.sleep(1)
    yield "Stream ended.\n"
"""


def generate_messages():
    yield "Starting stream...\n"
    for i in range(5):
        yield f"Message {i}\n"
        time.sleep(1)  # Simulating a delay in generating messages
    yield "Stream ended.\n"


def stream():

    @stream_with_context
    def generate():
        for message in generate_messages():
            yield f"data: {message}\n\n"
            import sys
            sys.stdout.flush()

    return Response(generate(), content_type='text/event-stream')


def daily_message():
    user_id_str: str = request.args.get('user_id', '')
    if not user_id_str or user_id_str == '':
        return jsonify(error="user_id is required"), 400

    try:
        user_id: int = int(user_id_str)  # Convert user_id to an integer
    except ValueError:
        return jsonify(error="user_id must be an integer"), 400

    response = requests.get(
        f'http://localhost:8080/api/latest-thread?user_id={user_id}')
    if response.status_code != 200:
        return jsonify(
            error="Failed to fetch latest thread ID"), response.status_code

    thread_id = response.json().get('thread_id')
    #if thread_id is None:
    #    return jsonify(message="No thread found for the user", thread_id=None)

    client = Client(api_key=os.getenv('OPENAI_API_KEY'))

    resume_thread: bool = False
    if thread_id:
        thread = client.beta.threads.retrieve(thread_id=thread_id)
        resume_thread = True
    else:
        resume_thread = False
        thread = client.beta.threads.create()
        thread_id = thread.id
        print(f"thread_id: {thread_id}")
        # Save thread id to db for this user
        save_thread_response = requests.post(
            'http://localhost:8080/api/user-thread',
            json={
                'user_id': user_id,
                'thread_id': thread_id
            })
        if save_thread_response.status_code != 200:
            return jsonify(error="Failed to save thread ID"
                           ), save_thread_response.status_code

    # get openai assistant
    assistant_id: str = os.getenv('ASSISTANT_ID', '')
    if assistant_id == '':
        return jsonify(
            error="ASSISTANT_ID environment variable is not set"), 500

    assistant = client.beta.assistants.retrieve(assistant_id)
    print(assistant)

    # start a thread with the assistant. new thread or existing if found in the db for this user
    # add a message to the thread "send an encouraging message"
    eternal_optimist_tools = [GetUserMission]

    message_generator = get_completion(
        client=client,
        message=
        f"send an encouraging message to user {user_id}. use tools to get the user's mission and recent daily todo history :)",
        agent=assistant,
        funcs=eternal_optimist_tools,
        thread=thread)

    @stream_with_context
    def generate():
        full_message = ""
        for message in message_generator:
            full_message += message
            yield f"data: {message}\n\n"
            import sys
            sys.stdout.flush()

    return Response(generate(), content_type='text/event-stream')


if __name__ == '__main__':
    print('hello world')
    user_id: int = 1

    response = requests.get(
        f'http://localhost:8080/api/latest-thread?user_id={user_id}')

    thread_id = response.json().get('thread_id')

    load_dotenv()
    api_key1 = os.getenv('OPENAI_API_KEY')
    client = Client(api_key=api_key1)

    resume_thread: bool = False
    if thread_id:
        thread = client.beta.threads.retrieve(thread_id=thread_id)
        resume_thread = True
    else:
        resume_thread = False
        thread = client.beta.threads.create()
        thread_id = thread.id
        print(f"new thread_id: {thread_id}")

    # get openai assistant
    assistant_id: str = os.getenv('ASSISTANT_ID', '')

    assistant = client.beta.assistants.retrieve(assistant_id)
    print(assistant)
    print(thread)
    print(thread.id)

    # start a thread with the assistant. new thread or existing if found in the db for this user
    # add a message to the thread "send an encouraging message"
    eternal_optimist_tools = [GetUserMission]

    message_generator = get_completion_stream(
        client=client,
        message=
        f"send an encouraging message to user {user_id}. use tools to get the user's mission and recent daily todo history :)",
        agent=assistant,
        funcs=eternal_optimist_tools,
        thread=thread)

    for message in message_generator:
        wprint(message)
"""
    @stream_with_context
    def generate():
        full_message = ""
        for message in message_generator:
            full_message += message
            yield f"data: {message}\n\n"
            import sys
            sys.stdout.flush()
            """
