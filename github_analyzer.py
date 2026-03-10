import requests
import streamlit as st


@st.cache_data(show_spinner=False)
def fetch_repo_data(repo_url):

    try:
        owner = repo_url.split("/")[-2]
        repo = repo_url.split("/")[-1]

        repo_api = f"https://api.github.com/repos/{owner}/{repo}"
        contents_api = f"https://api.github.com/repos/{owner}/{repo}/contents"

        repo_response = requests.get(repo_api, timeout=10)

        if repo_response.status_code != 200:
            return None

        repo_data = repo_response.json()

        contents_response = requests.get(contents_api, timeout=10)

        file_names = []

        if contents_response.status_code == 200:
            contents = contents_response.json()

            if isinstance(contents, list):
                file_names = [file["name"].lower() for file in contents]

        return {
            "name": repo_data.get("name"),
            "description": repo_data.get("description"),
            "language": repo_data.get("language"),
            "stars": repo_data.get("stargazers_count"),
            "forks": repo_data.get("forks_count"),
            "size": repo_data.get("size"),
            "files": file_names
        }

    except Exception:
        return None