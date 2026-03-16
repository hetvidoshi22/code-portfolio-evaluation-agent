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
st.caption("Agentic AI prototype for evaluating GitHub portfolios in hiring workflows.")
st.write("Analyze GitHub repositories and receive portfolio insights.")

# Initialize session state
if "repo_url" not in st.session_state:
    st.session_state.repo_url = ""

# Example repo button
if st.button("Try Example Repository"):
    st.session_state.repo_url = "https://github.com/streamlit/streamlit"

# Input field
repo_url = st.text_input(
    "Enter GitHub Repository URL",
    value=st.session_state.repo_url
)

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

    # Score calculation
    score = calculate_score(repo_data)

    # Repo information
    st.subheader("Repository Information")

    st.json({
        "name": repo_data["name"],
        "description": repo_data["description"],
        "language": repo_data["language"],
        "stars": repo_data["stars"],
        "forks": repo_data["forks"],
        "size": repo_data["size"]
    })

    # Portfolio score
    st.subheader("Portfolio Score")
    st.progress(score / 100)
    st.write(f"{score}/100")

    # Portfolio verdict
    if score >= 80:
        verdict = "🟢 Strong Portfolio"
        verdict_msg = "This repository demonstrates strong engineering practices and project quality."

    elif score >= 60:
        verdict = "🟡 Good Portfolio"
        verdict_msg = "The project shows solid implementation but could benefit from further improvements."

    else:
        verdict = "🔴 Needs Improvement"
        verdict_msg = "The repository requires additional documentation, structure, or features."

    st.subheader("Portfolio Evaluation")
    st.success(verdict)
    st.write(verdict_msg)

    # AI insights
    st.subheader("AI Insights")

    with st.spinner("Generating insights..."):
        insights = evaluate_repo(repo_data)

    st.write(insights)