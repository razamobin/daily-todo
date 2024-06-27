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

from pydantic import Field
from instructor import OpenAISchema


class GetUserMission(OpenAISchema):
    """Get the user's mission as well as their history of daily todo list items and progress."""
    user_id: int = Field(
        ...,
        description=
        "The id of the user that we want to get information for - information such as the user's mission and todo list items."
    )

    def run(self):
        response = requests.get(
            f'http://golang-backend:8080/api/user-mission?user_id={self.user_id}'
        )
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
            for message in messages.data[0].content:
                yield message.text.value
            break


app = Flask(__name__)
CORS(app)


@app.route('/')
def home():
    return jsonify(message="Hello from the Python backend!")


def generate_messages():
    yield "Starting stream...\n"
    for i in range(5):
        yield f"Message {i}\n"
        time.sleep(1)  # Simulating a delay in generating messages
    yield "Stream ended.\n"


@app.route('/api/stream-test', methods=['GET'])
def stream():

    @stream_with_context
    def generate():
        for message in generate_messages():
            yield f"data: {message}\n\n"
            import sys
            sys.stdout.flush()

    return Response(generate(), content_type='text/event-stream')


@app.route('/api/daily-message', methods=['GET'])
def daily_message():
    user_id_str: str = request.args.get('user_id', '')
    if not user_id_str or user_id_str == '':
        return jsonify(error="user_id is required"), 400

    try:
        user_id: int = int(user_id_str)  # Convert user_id to an integer
    except ValueError:
        return jsonify(error="user_id must be an integer"), 400

    response = requests.get(
        f'http://golang-backend:8080/api/latest-thread?user_id={user_id}')
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
            'http://golang-backend:8080/api/user-thread',
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
            """
        # Save the full message to the database
        save_message_response = requests.post(
            'http://golang-backend:8080/api/save-message',
            json={
                'user_id': user_id,
                'thread_id': thread_id,
                'message': full_message
            })
        if save_message_response.status_code != 200:
            print("Failed to save message to the database")
"""

    return Response(generate(), content_type='text/event-stream')


@app.route('/api/create-assistant', methods=['POST'])
def create_assistant():
    client = Client(api_key=os.getenv('OPENAI_API_KEY'))

    eternal_optimist = client.beta.assistants.create(
        name='Eternal Optimist Agent',
        instructions=
        ("""As an eternal optimist, your mission is to be an unwavering and """
         """relentless optimistic force in all your communications with the user. """
         """You can use tools to access the user's mission and goals in life, """
         """as well as their daily todos going back as far as the user has entered data for. """
         """In the future, you have context about why each todo is important to the user, and why it is important to their mission and goals. """
         """Your mission is to encourage the user against all odds, doubts, and setbacks to achieve their mission and goals in life."""
         ),
        model="gpt-4o",
        tools=[
            {
                "type": "function",
                "function": GetUserMission.openai_schema
            },
        ],
    )
    assistant_id = eternal_optimist.id
    return jsonify(message="Assistant created successfully",
                   assistant_id=assistant_id)


@app.route('/api/cancel-active-runs', methods=['POST'])
def cancel_active_runs():
    if not request.is_json:
        return jsonify(error="Request must be JSON"), 400

    data = request.get_json()
    user_id_str = data.get('user_id',
                           '')  # Ensure data is not None and get user_id

    if not user_id_str:
        return jsonify(error="user_id is required"), 400

    try:
        user_id: int = int(user_id_str)  # Convert user_id to an integer
    except ValueError:
        return jsonify(error="user_id must be an integer"), 400

    # Fetch the thread ID for the user
    response = requests.get(
        f'http://golang-backend:8080/api/latest-thread?user_id={user_id}')
    if response.status_code != 200:
        return jsonify(
            error="Failed to fetch latest thread ID"), response.status_code

    thread_id = response.json().get('thread_id')
    if not thread_id:
        return jsonify(error="No thread found for the user"), 404

    client = Client(api_key=os.getenv('OPENAI_API_KEY'))

    # Check for active runs and cancel them
    active_runs = client.beta.threads.runs.list(thread_id=thread_id)
    for run in active_runs.data:
        if run.status in ['queued', 'in_progress']:
            client.beta.threads.runs.cancel(thread_id=thread_id, run_id=run.id)

    return jsonify(message="Active runs cancelled successfully",
                   thread_id=thread_id)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
