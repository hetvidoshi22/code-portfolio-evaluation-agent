import os
import streamlit as st
from dotenv import load_dotenv
import google.generativeai as genai

@st.cache_data(show_spinner=False)
def evaluate_repo(repo_data):

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-2.0-flash")


def evaluate_repo(repo_data):

    prompt = f"""
You are an AI agent evaluating a GitHub repository for a hiring platform.

Repository:
Name: {repo_data['name']}
Description: {repo_data['description']}
Language: {repo_data['language']}
Stars: {repo_data['stars']}
Forks: {repo_data['forks']}
Key Files: {repo_data['files'][:10]}

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