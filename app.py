import streamlit as st
from github_analyzer import fetch_repo_data
from scoring import calculate_score
from evaluator import evaluate_repo

# Page configuration
st.set_page_config(
    page_title="Code Portfolio Evaluation Agent",
    page_icon="🤖",
    layout="centered"
)

# Title
st.title("Code Portfolio Evaluation Agent")

st.write("Analyze GitHub repositories and receive portfolio insights.")

# Input
repo_url = st.text_input("Enter GitHub Repository URL")

# Example repo button (helps reviewers test quickly)
if st.button("Try Example Repository"):
    repo_url = "https://github.com/streamlit/streamlit"
    st.session_state.repo_url = repo_url

# Analyze button
if st.button("Analyze Portfolio"):

    if not repo_url:
        st.warning("Please enter a GitHub repository URL.")
        st.stop()

    with st.spinner("Fetching repository data..."):
        repo_data = fetch_repo_data(repo_url)

    if repo_data is None:
        st.error("Could not fetch repository data. Please check the repository URL.")
        st.stop()

    st.success("Repository data fetched successfully")

    # Calculate score
    score = calculate_score(repo_data)

    # Repository information
    st.subheader("Repository Information")

    st.json({
        "name": repo_data["name"],
        "description": repo_data["description"],
        "language": repo_data["language"],
        "stars": repo_data["stars"],
        "forks": repo_data["forks"],
        "size": repo_data["size"]
    })

    # Score section
    st.subheader("Portfolio Score")
    st.progress(score / 100)
    st.write(f"{score}/100")

    # AI insights
    st.subheader("AI Insights")

    with st.spinner("Generating insights..."):
        insights = evaluate_repo(repo_data)

    st.write(insights)