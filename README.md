# Code Portfolio Evaluation Agent

An AI-powered system that analyzes GitHub repository and generates portfolio insights to help evaluate technical candidates.
The agent automatically inspects repository structure, technologies used, documentation presence, and project complexity, then produces a **portfolio score and improvement recommendations**.

---

## Problem

Many technical candidates include GitHub repositories in their profiles, but recruiters often do not have the time or technical expertise to evaluate multiple repositories manually. This can lead to inconsistent evaluation and strong candidates being overlooked.

The **Code Portfolio Evaluation Agent** solves this by automatically analyzing repositories and converting technical signals into structured insights.

---

## Features

* GitHub repository analysis using GitHub API
* Automated portfolio scoring based on repository signals
* AI-generated insights using Gemini
* Suggestions for improving project quality
* Interactive Streamlit interface for quick evaluation

---

## Tech Stack

* **Python**
* **Streamlit**
* **GitHub REST API**
* **Google Gemini API**
* **dotenv for secure API key handling**

---

## System Workflow

The following workflow shows how the AI agent evaluates a repository.

![Agent Workflow](assets/agent_workflow.png)

Steps:

1. User submits a GitHub repository URL
2. The system fetches repository metadata via the GitHub API
3. Repository structure and signals are analyzed
4. The AI agent evaluates the project using Gemini
5. A portfolio score and improvement suggestions are generated
6. Results are displayed on the dashboard

---

## Project Structure

```
code-portfolio-evaluation-agent
│
├── app.py
├── github_analyzer.py
├── scoring.py
├── evaluator.py
├── requirements.txt
├── .env
├── README.md
│
└── assets
    ├── agent_workflow.png
```

---

## Installation

Clone the repository:

```
git clone https://github.com/YOUR_USERNAME/code-portfolio-evaluation-agent.git
cd code-portfolio-evaluation-agent
```

Install dependencies:

```
pip install -r requirements.txt
```

---

## Environment Setup

Create a `.env` file in the project root.

```
GEMINI_API_KEY=your_api_key_here
```

---

## Run the Application

Start the Streamlit app:

```
streamlit run app.py
```

The app will open in your browser:

```
http://localhost:8501
```

---

## Example Usage

Input:

```
https://github.com/username/project
```

Output:

* Portfolio Score
* Strengths of the repository
* Improvement suggestions

---

## Future Improvements

* Analyze multiple repositories from a GitHub profile
* Add deeper code quality metrics
* Detect testing frameworks and CI pipelines
* Improve scoring model with more repository signals

---