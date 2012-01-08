from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.api import memcache

from google.appengine.api import urlfetch

import logging
try:
    import json
except ImportError:
    import simplejson as json

################################################################################
# Controllers

GITHUB_API_URL_BASE = "https://api.github.com/"
GITHUB_URL_BASE = "https://github.com/"

class Index(webapp.RequestHandler):
    def get(self):
        # check if we have a user
        if not(self.request.get("user", None)):
            self.response.out.write(template.render("templates/index.html", {}))
            return
        user = self.request.get("user")

        # check if the user is in memcache
        data = memcache.get("user")
        if data is None:
            # get the repos (users/:user/repos)
            repo_list_url = GITHUB_API_URL_BASE + "users/%s/repos" % user
            # make the request
            result = urlfetch.fetch(repo_list_url)
            requests_left = result.headers["X-RateLimit-Remaining"]
            ## we might use this if we reroute to oauth to get around limits
            # usernames are (\w|\-)
            if not memcache.add("_requests_left", requests_left, 60):
                logging.error("Memcache set failed.")
            if result.status_code != 200:
                # !!!
                raise Exception("Could not find a username")
            repos = json.loads(result.content)
            repo_names = [r['name'] for r in repos]

            # !!! MOVE THIS TO THE CLIENT SIDE
            # !!! Cross Origin Resource Sharing for AJAX requests, reg oauth
            # get number of commits for each repo
            repos = {}
            for repo in repo_names:
                repo_commits_url = \
                    "%s%s/%s/graphs/participation" % (GITHUB_URL_BASE, 
                                                      user, repo)
                result = urlfetch.fetch(repo_commits_ur)
                if result.status_code != 200:
                    # !!!
                    raise Exception("Could not fetch a repo's commits")
                thing = json.loads(result.content)
                # might use "all" if we want to display that
                repos[repo] = thing["owner"]

            data = repos
            # write out to memcache
            if not memcache.add(user, data, 60):
                logging.error("Memcache set failed.")

        self.response.out.write("yay")
    # just reroute back to GET
    def post(self):
        self.get()



application = webapp.WSGIApplication(
    [('/', Index),
     ],
    debug=True)

def main():
    run_wsgi_app(application)

if __name__ == "__main__":
    main()
