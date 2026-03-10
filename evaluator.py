import os
import streamlit as st
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-2.0-flash")


@st.cache_data(show_spinner=False)
def evaluate_repo(repo_data):

    prompt = f"""
You are an AI agent evaluating a GitHub repository for a hiring platform.

Repository:
Name: {repo_data['name']}
Description: {repo_data['description']}
Language: {repo_data['language']}
Stars: {repo_data['stars']}
Forks: {repo_data['forks']}
Files: {repo_data['files'][:5]}

Rules:
- Only suggest improvements that are NOT already present.
- If README.md exists, do NOT suggest adding documentation.
- If .gitignore exists, do NOT suggest adding it.

Return only:

Strengths:
- bullet points

Improvement Suggestions:
- bullet points
"""

    try:
        response = model.generate_content(prompt, request_options={"timeout": 10})
        return response.text
    except Exception:
        return "AI insights could not be generated."