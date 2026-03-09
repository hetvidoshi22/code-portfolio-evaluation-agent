import streamlit as st
from github_analyzer import fetch_repo_data
from scoring import calculate_score
from evaluator import evaluate_repo

st.title("Code Portfolio Evaluation Agent")

st.write("Analyze GitHub repositories and receive portfolio insights.")

repo_url = st.text_input("Enter GitHub Repository URL")

if st.button("Analyze Portfolio"):

    repo_data = fetch_repo_data(repo_url)

    if repo_data is None:
        st.error("Could not fetch repository data.")
    else:

        score = calculate_score(repo_data)

        st.subheader("Repository Information")
        st.write(repo_data)

        st.subheader("Portfolio Score")
        st.write(f"{score}/100")

        st.subheader("AI Insights")

        insights = evaluate_repo(repo_data)

        st.write(insights)