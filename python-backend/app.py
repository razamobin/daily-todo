# python-backend/app.py
import builtins
import json
import queue
import textwrap
import threading
import time
from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS
import requests
import openai
from openai import AssistantEventHandler, Client
import os
from typing import List
from openai.types.beta.function_tool_param import FunctionToolParam
from openai.types.beta.threads import Message, MessageDelta
from openai.types.beta.threads.runs import ToolCall
from openai.types.beta.threads.runs import RunStep
from openai.types.beta.threads.runs import FunctionToolCallDelta
from openai.types.beta.assistant_stream_event import AssistantStreamEvent
from typing_extensions import override
import re

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
        token = os.getenv('BEARER_TOKEN', '')
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(
            f'{API_BASE_URL}/api/user-mission?user_id={self.user_id}',
            headers=headers)
        if response.status_code != 200:
            return f"Error: Failed to fetch the user mission, Status Code: {response.status_code}"
        else:
            return json.dumps(response.json())


app = Flask(__name__)
CORS(app,
     resources={
         r"/*": {
             "origins": [
                 "http://localhost:3000",
                 "http://app-backend-lb-330001835.us-west-2.elb.amazonaws.com",
                 "https://dailytodos.ai",
                 "https://www.dailytodos.ai",
                 "https://api1.dailytodos.ai",
                 "https://api2.dailytodos.ai",
             ]
         }
     },
     supports_credentials=True)

API_BASE_URL = os.getenv('API_BASE_URL', 'http://golang-backend:8080')


def forward_request_with_session_cookie(path, method='GET', json=None):
    session_cookie = request.cookies.get('session_id')
    headers = {}
    if session_cookie:
        headers['Cookie'] = f'session_id={session_cookie}'

    url = f"{API_BASE_URL}{path}"

    if method == 'GET':
        return requests.get(url, headers=headers)
    elif method == 'POST':
        return requests.post(url, headers=headers, json=json)
    else:
        raise ValueError(f"Unsupported method: {method}")


@app.route('/')
def home():
    return jsonify(message="Hello from the Python backend!")


def get_completion_stream(client, message, agent, funcs, thread, q,
                          full_message_queue):
    #q.put("yield: Stream started.\n")

    message = client.beta.threads.messages.create(thread_id=thread.id,
                                                  role="user",
                                                  content=message)

    class EventHandler(AssistantEventHandler):

        def __init__(self, thread_id, assistant_id, q, full_message_queue):
            super().__init__()
            self.output = None
            self.tool_id = None
            self.thread_id = thread_id
            self.assistant_id = assistant_id
            self.run_id = None
            self.run_step: RunStep | None = None
            self.function_name = ""
            self.arguments = ""
            self.q = q
            self.full_message_queue = full_message_queue  # Store the full message queue

        @override
        def on_text_created(self, text) -> None:
            print(f"\nassistant on_text_created > ", end="", flush=True)

        @override
        def on_text_delta(self, delta, snapshot):
            self.q.put(f"{delta.value}")

        @override
        def on_end(self, ):
            print(f"\n end assistant > ",
                  self.current_run_step_snapshot,
                  end="",
                  flush=True)

        @override
        def on_exception(self, exception: Exception) -> None:
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
            # Extract the text value from the message content
            full_message = ''.join([
                block.text.value for block in message.content
                if block.type == 'text'
            ])
            # Put the full message into the full_message_queue
            self.full_message_queue.put(full_message)

        @override
        def on_message_delta(self, delta: MessageDelta,
                             snapshot: Message) -> None:
            pass

        def on_tool_call_created(self, tool_call: ToolCall):
            print(f"\nassistant on_tool_call_created > {tool_call}")
            self.function_name = tool_call.function.name
            self.tool_id = tool_call.id
            print(
                f"\non_tool_call_created > run_step.status > {self.run_step.status}"
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

                func = next(
                    iter([
                        func for func in funcs
                        if func.__name__ == self.function_name
                    ]))

                try:
                    func = func(**eval(tool_call.function.arguments))
                    self.output = func.run()
                except Exception as e:
                    self.output = "Error: " + str(e)

                with client.beta.threads.runs.submit_tool_outputs_stream(
                        thread_id=self.thread_id,
                        run_id=self.run_id,
                        tool_outputs=[{
                            "tool_call_id": self.tool_id,
                            "output": self.output,
                        }],
                        event_handler=EventHandler(
                            self.thread_id, self.assistant_id, self.q,
                            self.full_message_queue)) as stream:
                    stream.until_done()

        @override
        def on_run_step_created(self, run_step: RunStep) -> None:
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
            if event.event == "thread.run.requires_action":
                print("\nthread.run.requires_action > submit tool call")
                print(f"ARGS: {self.arguments}")

    with client.beta.threads.runs.stream(
            thread_id=thread.id,
            assistant_id=agent.id,
            event_handler=EventHandler(thread_id=thread.id,
                                       assistant_id=agent.id,
                                       q=q,
                                       full_message_queue=full_message_queue),
    ) as stream:
        stream.until_done()

    q.put("yield: Stream ended.\n")


def clean_markdown(message: str) -> str:
    """
    Remove markdown code block syntax from the start and end of the string.
    
    Args:
    message (str): The input markdown string.
    
    Returns:
    str: The cleaned markdown string.
    """
    message = re.sub(r'^```markdown\s*', '', message)
    message = re.sub(r'\s*```$', '', message)
    return message


@app.route('/api/daily-message', methods=['GET'])
def daily_message():
    # Get the logged-in user
    response = forward_request_with_session_cookie('/api/logged-in-user')
    if response.status_code == 401:

        @stream_with_context
        def generate():
            yield "event: end\ndata: END\n\n"

        return Response(generate(), content_type='text/event-stream')
    elif response.status_code != 200:
        return jsonify(
            error="Failed to fetch logged in user"), response.status_code

    user_data = response.json()
    user_id = user_data.get('id')
    if not user_id:
        return jsonify(error="User ID not found"), 400

    new_day_number_str: str = request.args.get('new_day_number', '')
    if not new_day_number_str or new_day_number_str == '':
        return jsonify(error="new_day_number is required"), 400

    try:
        new_day_number: int = int(
            new_day_number_str)  # Convert new_day_number to an integer
    except ValueError:
        return jsonify(error="new_day_number must be an integer"), 400

    # Check if a message already exists for the given user and new_day_number
    response = forward_request_with_session_cookie(
        f'/api/get-saved-assistant-message?day_number={new_day_number}')
    if response.status_code == 200:
        existing_message = response.json().get('message')
        if existing_message:

            @stream_with_context
            def generate():
                cleaned_message = clean_markdown(existing_message)
                escaped_message = cleaned_message.replace('\n', '\\n')
                yield f"data: {escaped_message}\n\n"
                yield "event: end\ndata: END\n\n"

            return Response(generate(), content_type='text/event-stream')
    elif response.status_code != 404:
        return jsonify(
            error="Failed to check for existing message"), response.status_code

    # get user info, and make AI assistant request with that info to get the latest encouraging message

    # Fetch the user's first name
    response = forward_request_with_session_cookie('/api/user-first-name')
    if response.status_code != 200:
        return jsonify(
            error="Failed to fetch user's first name"), response.status_code

    first_name = response.json().get('first_name')
    if not first_name:
        return jsonify(error="User's first name not found"), 404

    response = forward_request_with_session_cookie('/api/latest-thread')
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
        save_thread_response = forward_request_with_session_cookie(
            '/api/user-thread', method='POST', json={'thread_id': thread_id})
        if save_thread_response.status_code != 200:
            return jsonify(error="Failed to save thread ID"
                           ), save_thread_response.status_code

    # get openai assistant
    response = forward_request_with_session_cookie('/api/assistant-id')
    if response.status_code != 200:
        return jsonify(
            error="Failed to fetch assistant ID"), response.status_code

    assistant_id = response.json().get('assistant_id')
    if not assistant_id:
        return jsonify(error="Assistant ID not found"), 404

    assistant = client.beta.assistants.retrieve(assistant_id)
    #print(assistant)

    # start a thread with the assistant. new thread or existing if found in the db for this user
    # add a message to the thread "send an encouraging message"
    eternal_optimist_tools = []

    # Fetch the user's mission and history using Bearer token
    token = os.getenv('BEARER_TOKEN', '')
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(
        f'{API_BASE_URL}/api/user-mission?user_id={user_id}', headers=headers)
    if response.status_code != 200:
        return jsonify(error="Failed to fetch user mission and history"
                       ), response.status_code

    user_mission_history = response.json()
    user_mission_history_str = json.dumps(user_mission_history)

    #print(user_mission_history_str)

    q = queue.Queue()
    full_message_queue = queue.Queue()  # New queue for the full message

    completion_thread = threading.Thread(target=get_completion_stream,
                                         args=(client, f"""
       At the end of this message I've included a JSON data string which contains all the 
       information you will need to compose an encouraging message for the user today. 
       The data contains the user's mission in life, their recent history of daily todo 
       items (that they feel helps them reach their goals and accomplish their mission), 
       and the reasons why each todo item is important to them and their mission. The 
       user has also included daily notes of how each todo item went on a particular day, 
       like a mini journal entry. Please address the user by their first name {first_name}. 
       In your message, be sure to include specific encouragement on how well the user is 
       doing. Identify and reference ALL streaks they have (7 days in a row of gym for 
       example). Acknowledge any difficulties and obstacles that they've overcome based on 
       the notes they've provided or any other relevant information. Emphazise all the 
       amazing progress they're making. Emphasize how consistent they are. Reminder 
       that you are an eternal optimist, your mission is to be an unwavering optimistic 
       force in all your communications with the user. Your mission is to encourage 
       {first_name} against all odds, doubts, and setbacks to achieve their mission and 
       goals in life. JSON data: {user_mission_history_str}
        """, assistant, eternal_optimist_tools, thread, q, full_message_queue))
    completion_thread.start()

    @stream_with_context
    def generate():
        while True:
            message = q.get(block=True)
            if "Stream ended." in message:
                break
            else:
                escaped_message = message.replace('\n', '\\n')
                yield f"data: {escaped_message}\n\n"

        # Retrieve the full message from the full_message_queue
        full_message = full_message_queue.get(block=True)

        print('1', full_message)
        full_message = clean_markdown(full_message)
        print('2', full_message)

        # Save the full message to the database
        save_message_response = forward_request_with_session_cookie(
            '/api/save-assistant-message',
            method='POST',
            json={
                'day_number': new_day_number,
                'message': full_message
            })
        if save_message_response.status_code != 200:
            print("Failed to save message to the database")

        # Send a custom event to signal the end of the stream
        yield "event: end\ndata: END\n\n"

    return Response(generate(), content_type='text/event-stream')


@app.route('/api/create-assistant', methods=['POST'])
def create_assistant():

    # Check if an assistant already exists in the database
    response = forward_request_with_session_cookie('/api/assistant-id')
    if response.status_code == 200:
        assistant_id = response.json().get('assistant_id')
        if assistant_id:
            # Check if the assistant exists in OpenAI
            client = Client(api_key=os.getenv('OPENAI_API_KEY'))
            try:
                assistant = client.beta.assistants.retrieve(assistant_id)
                print('found assistant in openai')
                print(assistant)
                return jsonify(message="Assistant already exists 2",
                               assistant_id=assistant_id), 200
            except Exception as e:
                print('exception trying to get assistant in openai')
                print(e)
                # If the assistant does not exist in OpenAI, proceed to create a new one
                pass
    elif response.status_code != 404:
        return jsonify(error="Failed to check for existing assistant"
                       ), response.status_code

    # Proceed with creating a new assistant
    client = Client(api_key=os.getenv('OPENAI_API_KEY'))

    eternal_optimist = client.beta.assistants.create(
        name='Eternal Optimist Agent',
        instructions=
        ("""As an eternal optimist, your mission is to be an unwavering and relentless """
         """optimistic force in all your communications with the user. You will be given """
         """the context such as the user's mission and goals in life, as well as their daily """
         """todos going back a week or so. You also have context about why each todo is """
         """important to the user, and why it is important to their mission and goals. """
         """Your mission is to encourage the user against all odds, doubts, and setbacks to """
         """achieve their mission and goals in life. Always return your messages in markdown """
         """format. Be sure to escape special characters when referencing a user's todo """
         """items to avoid formatting issues."""),
        model="gpt-3.5-turbo",
        tools=[
            #   {
            #       "type": "function",
            #       "function": GetUserMission.openai_schema
            #   },
        ],
    )
    assistant_id = eternal_optimist.id

    # Save the assistant_id to the MySQL database
    response = forward_request_with_session_cookie(
        '/api/save-assistant-id',
        method='POST',
        json={'assistant_id': assistant_id})
    if response.status_code != 200:
        return jsonify(
            error="Failed to save assistant ID"), response.status_code

    return jsonify(message="Assistant created successfully",
                   assistant_id=assistant_id)


@app.route('/lbhealth', methods=['GET'])
def lb_health_check():
    return "healthy", 200


@app.route('/health', methods=['GET'])
def health_check():
    health_status = {
        "golang_backend": {
            "status": "unhealthy",
            "url": API_BASE_URL,
            "response_length": 0
        },
        "openai_api": {
            "status": "unhealthy",
            "assistants_count": 0
        },
        "bearer_token": {
            "status": "not set",
            "length": 0
        },
        "logged_in_user": {
            "status": "not logged in",
            "user_info": None
        }
    }

    # Check Golang backend connection
    try:
        response = requests.get(f'{API_BASE_URL}/health', timeout=5)
        if response.status_code == 200:
            health_status["golang_backend"]["status"] = "healthy"
            health_status["golang_backend"]["response_length"] = len(
                response.text)
    except requests.RequestException as e:
        health_status["golang_backend"]["status"] = f"unhealthy: {str(e)}"

    # Check OpenAI API connection
    openai_api_key = os.getenv('OPENAI_API_KEY')
    if openai_api_key:
        try:
            client = openai.OpenAI(api_key=openai_api_key)
            assistants = client.beta.assistants.list(limit=10)
            assistants_count = len(list(assistants))
            health_status["openai_api"]["status"] = "healthy"
            health_status["openai_api"]["assistants_count"] = assistants_count
        except Exception as e:
            health_status["openai_api"]["status"] = f"unhealthy: {str(e)}"
    else:
        health_status["openai_api"]["status"] = "unhealthy: API key not set"

    # Check BEARER token
    bearer_token = os.getenv('BEARER_TOKEN', '')
    if bearer_token:
        health_status["bearer_token"]["status"] = "set"
        health_status["bearer_token"]["length"] = len(bearer_token)

    # Check logged-in user
    user_response = forward_request_with_session_cookie('/api/logged-in-user')
    if user_response.status_code == 200:
        user_data = user_response.json()
        health_status["logged_in_user"]["status"] = "logged in"
        health_status["logged_in_user"]["user_info"] = user_data
    elif user_response.status_code == 401:
        health_status["logged_in_user"]["status"] = "not logged in"
    else:
        health_status["logged_in_user"][
            "status"] = f"error: {user_response.status_code}"

    # Determine overall health status
    is_healthy = (health_status["golang_backend"]["status"] == "healthy"
                  and health_status["openai_api"]["status"] == "healthy"
                  and health_status["bearer_token"]["status"] == "set")

    return jsonify(health_status), 200 if is_healthy else 500


@app.after_request
def after_request(response):
    print(f"Request from: {request.origin}")
    print(f"Response headers: {response.headers}")
    return response


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
