import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-flash-latest")


def evaluate_repo(repo_data):

    prompt = f"""
You are an AI agent evaluating a GitHub repository for a hiring platform.

Repository:
Name: {repo_data['name']}
Description: {repo_data['description']}
Language: {repo_data['language']}
Stars: {repo_data['stars']}
Forks: {repo_data['forks']}
Files: {repo_data['files']}

Rules:
- Only suggest improvements that are NOT already present.
- If README.md exists, do NOT suggest adding documentation.
- If .gitignore exists, do NOT suggest adding it.

Return only:

Strengths:
- ...

Improvement Suggestions:
- ...
"""

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception:
        return "AI insights could not be generated."