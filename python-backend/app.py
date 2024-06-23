# python-backend/app.py
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.route('/')
def home():
    return jsonify(message="Hello from the Python backend!")


@app.route('/api/daily-message', methods=['GET'])
def daily_message():
    return jsonify(message="Hello, World!")


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
