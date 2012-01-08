import requests
import json
from pprint import pprint

URL_BASE = "https://api.github.com/"

user = "thenoviceoof"

# get the repos (users/:user/repos)
repo_list_url = URL_BASE + "users/%s/repos" % user
req = requests.get(repo_list_url)
print(req.headers["X-RateLimit-Remaining"])
repos = json.loads(req.content) 
repo_names = [r['name'] for r in repos]
pprint(repo_names)

# get number of commits each repo
repo = repos_names[0]
URL_GITHUB = "https://github.com/"
repo_commits_url = URL_GITHUB + "%s/%s/graphs/participation" % (user, repo)
print(repo_commits_url)
req = requests.get(repo_commits_url)
print(user, repo)
print(req.content)
thing = json.loads(req.content)
print(thing["all"])
