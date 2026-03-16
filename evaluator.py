import os
import streamlit as st
from google import genai

api_key = os.getenv("GEMINI_API_KEY") or st.secrets.get("GEMINI_API_KEY")

if not api_key:
    raise ValueError("Gemini API key not found")

client = genai.Client(api_key=api_key)


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

Return:

Strengths:
- bullet points

Improvement Suggestions:
- bullet points
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        return response.text

    except Exception as e:
        return f"AI insights could not be generated.\n\nError: {str(e)}"