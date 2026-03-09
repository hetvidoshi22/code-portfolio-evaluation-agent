import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Get API key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Correct model name
model = genai.GenerativeModel("gemini-1.5-flash")


def evaluate_repo(repo_data):

    prompt = f"""
You are an AI agent that evaluates GitHub repositories for a hiring platform.

Analyze the following repository:

Project Name: {repo_data['name']}
Description: {repo_data['description']}
Language: {repo_data['language']}
Stars: {repo_data['stars']}
Forks: {repo_data['forks']}

Evaluate:

1. Code quality
2. Project complexity
3. Documentation quality
4. Technology stack usage

Return the answer in this format:

Strengths:
- ...

Improvement Suggestions:
- ...
"""

    response = model.generate_content(prompt)

    return response.text