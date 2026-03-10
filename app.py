import streamlit as st
from github_analyzer import fetch_repo_data
from scoring import calculate_score
from evaluator import evaluate_repo

st.title("Code Portfolio Evaluation Agent")

st.write("Analyze GitHub repositories and receive portfolio insights.")

repo_url = st.text_input("Enter GitHub Repository URL")

if st.button("Analyze Portfolio"):

    if not repo_url:
        st.warning("Please enter a GitHub repository URL.")
    else:

        with st.spinner("Analyzing repository..."):

            repo_data = fetch_repo_data(repo_url)

            if repo_data is None:
                st.error("Could not fetch repository data.")
            else:

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
                st.success(f"{score}/100")

                st.subheader("AI Insights")

                insights = evaluate_repo(repo_data)

                st.write(insights)