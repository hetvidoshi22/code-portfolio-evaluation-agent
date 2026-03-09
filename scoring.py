def calculate_score(repo_data):

    score = 0

    if repo_data["description"]:
        score += 20

    if repo_data["language"]:
        score += 20

    if repo_data["stars"] > 5:
        score += 20

    if repo_data["forks"] > 2:
        score += 20

    if repo_data["size"] > 50:
        score += 20

    return min(score, 100)