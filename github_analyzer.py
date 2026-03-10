import requests
import streamlit as st

@st.cache_data(show_spinner=False)
def fetch_repo_data(repo_url):

    owner = repo_url.split("/")[-2]
    repo = repo_url.split("/")[-1]

    repo_api = f"https://api.github.com/repos/{owner}/{repo}"
    contents_api = f"https://api.github.com/repos/{owner}/{repo}/contents"

    repo_data = requests.get(repo_api).json()
    contents = requests.get(contents_api).json()

    file_names = [file["name"].lower() for file in contents]

    return {
        "name": repo_data["name"],
        "description": repo_data["description"],
        "language": repo_data["language"],
        "stars": repo_data["stargazers_count"],
        "forks": repo_data["forks_count"],
        "size": repo_data["size"],
        "files": file_names
    }