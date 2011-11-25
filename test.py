import requests
import json

url_base = "https://api.github.com/"

# get the repos (users/:user/repos)
requests.get(url_base+"users/%s/repos")

# repos/:user/:repo
# repos/:user/:repo/languages
# repos/:user/:repo/branches
# repos/:user/:repo/git/commits/:sha

# get number of commits each repo
