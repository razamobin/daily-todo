# python-backend/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import openai
from openai import Client
import os
from typing import List
from openai.types.beta.function_tool_param import FunctionToolParam

from pydantic import Field
from instructor import OpenAISchema

app = Flask(__name__)
CORS(app)


@app.route('/')
def home():
    return jsonify(message="Hello from the Python backend!")


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

    if thread_id:
        thread = client.beta.threads.retrieve(thread_id=thread_id)
    else:
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
    # get output from assistant, it will hopefully say call your function
    # call your function and give it what it wants (user mission data)
    # get output from assistant, hopefully the encouraging message. return it to the frontend. save to db.

    #assistants = client.beta.assistants.list()
    #print(type(assistants))
    #print(assistants)

    return jsonify(message="Hello, World!", thread_id=thread_id)


@app.route('/api/create-assistant', methods=['POST'])
def create_assistant():
    client = Client(api_key=os.getenv('OPENAI_API_KEY'))

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
                return jsonify(error="Failed to fetch latest thread ID"
                               ), response.status_code
            else:
                return response.json()

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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
