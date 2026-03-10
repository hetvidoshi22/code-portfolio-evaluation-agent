def calculate_score(repo_data):

    score = 0
    files = repo_data["files"]

    if "readme.md" in files:
        score += 20

    if "license" in files:
        score += 10

    if ".gitignore" in files:
        score += 10

    if repo_data["language"]:
        score += 15

    if repo_data["size"] > 100:
        score += 20

    if repo_data["stars"] > 0:
        score += 10

    if repo_data["forks"] > 0:
        score += 5

    # bonus for tests
    if "tests" in files or "test" in files:
        score += 10

    return min(score, 100)