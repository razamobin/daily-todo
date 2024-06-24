# python-backend/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)


@app.route('/')
def home():
    return jsonify(message="Hello from the Python backend!")


@app.route('/api/daily-message', methods=['GET'])
def daily_message():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify(error="user_id is required"), 400

    response = requests.get(
        f'http://golang-backend:8080/api/latest-thread?user_id={user_id}')
    if response.status_code != 200:
        return jsonify(
            error="Failed to fetch latest thread ID"), response.status_code

    thread_id = response.json().get('thread_id')
    if thread_id is None:
        return jsonify(message="No thread found for the user", thread_id=None)

    return jsonify(message="Hello, World!", thread_id=thread_id)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
