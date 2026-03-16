import streamlit as st

@st.cache_data(show_spinner=False)
def evaluate_repo(repo_data):

    strengths = []
    improvements = []

    files = repo_data["files"]

    # Strengths
    if "readme.md" in files:
        strengths.append("Repository includes documentation (README).")

    if ".gitignore" in files:
        strengths.append("Uses .gitignore indicating good version control practices.")

    if repo_data["language"]:
        strengths.append(f"Primary language detected: {repo_data['language']}.")

    if repo_data["size"] > 100:
        strengths.append("Project shows moderate implementation complexity.")

    if repo_data["stars"] > 0:
        strengths.append("Repository has community engagement through stars.")

    # Improvements
    if "readme.md" not in files:
        improvements.append("Add a README file explaining the project and usage.")

    if ".gitignore" not in files:
        improvements.append("Include a .gitignore file for cleaner version control.")

    if "license" not in files:
        improvements.append("Add a license file to clarify usage permissions.")

    if repo_data["stars"] == 0:
        improvements.append("Improve documentation and visibility to attract contributors.")

    if repo_data["forks"] == 0:
        improvements.append("Encourage collaboration by making contribution guidelines.")

    # Format output
    result = "### Strengths\n"
    for s in strengths:
        result += f"- {s}\n"

    result += "\n### Improvement Suggestions\n"
    for i in improvements:
        result += f"- {i}\n"

    return result