import streamlit as st
from github_analyzer import fetch_repo_data
from scoring import calculate_score
from evaluator import evaluate_repo

st.set_page_config(
    page_title="Code Portfolio Evaluation Agent",
    page_icon="🤖"
)

st.title("Code Portfolio Evaluation Agent")

st.write("Analyze GitHub repositories and receive portfolio insights.")

repo_url = st.text_input("Enter GitHub Repository URL")

if st.button("Analyze Portfolio"):

    if not repo_url:
        st.warning("Please enter a GitHub repository URL.")
        st.stop()

    with st.spinner("Fetching repository data..."):

        repo_data = fetch_repo_data(repo_url)

    if repo_data is None:
        st.error("Could not fetch repository data.")
        st.stop()

    st.success("Repository data fetched successfully")

    score = calculate_score(repo_data)

    st.subheader("Repository Information")

    st.json({
        "name": repo_data["name"],
        "description": repo_data["description"],
        "language": repo_data["language"],
        "stars": repo_data["stars"],
        "forks": repo_data["forks"],
        "size": repo_data["size"]
    })

    st.subheader("Portfolio Score")

    st.progress(score / 100)
    st.write(f"{score}/100")

    st.subheader("AI Insights")

    if st.button("Generate AI Insights"):

        with st.spinner("Generating AI insights..."):

            insights = evaluate_repo(repo_data)

        st.write(insights)