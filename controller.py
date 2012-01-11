from google.appengine.dist import use_library
use_library('django', '0.96')

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

TIMEOUT = 60 # assuming minutes, for the user data
REQUEST_LIMIT_TIMEOUT = 5 # assuming minutes, how long to keep the request limit
LOWER_REQUEST_LIMIT = 100 # how many requeststo stop trying to load

class Index(webapp.RequestHandler):
    def get(self):
        # check if we have a user
        user = self.request.get("user", None)
        if not(user):
            self.response.out.write(template.render("templates/index.html", {}))
            return

        # check if the user is in memcache
        data = memcache.get("user")
        if data is None:
            # check if we are hitting the request limit yet
            limit = memcache.get("_requests_left")
            if limit and limit < LOWER_REQUEST_LIMIT:
                # reroute to oauth
                self.response.out.write(template.render("templates/oauth.html",
                                                        {}))
                return

            # get the repos (users/:user/repos)
            repo_list_url = "%susers/%s/repos?type=all" % (GITHUB_API_URL_BASE,
                                                           user)
            # make the request
            result = urlfetch.fetch(repo_list_url)
            requests_left = result.headers["X-RateLimit-Remaining"]
            # usernames are (\w|\-), so _ disambiguates
            if not memcache.add("_requests_left", requests_left,
                                REQUEST_LIMIT_TIMEOUT):
                logging.error("Memcache set failed.")
            if result.status_code != 200:
                # !!! replace with a better exception?
                raise Exception("Could not find a username")
            repos = json.loads(result.content)
            repo_names = [{"name": r['name'], "user": r["owner"]["login"]}
                          for r in repos]
            data = repo_names

            # set the repo list
            if not memcache.add(user, data, TIMEOUT):
                logging.error("Memcache set failed.")

        pars = {"user": user, "repos": json.dumps(data)}
        self.response.out.write(template.render("templates/graph.html", pars))

    # just reroute back to GET
    def post(self):
        self.get()

class Repo(webapp.RequestHandler):
    def get(self, user, repo):
        # get number of commits for each repo
        # Note: can't move these requests to the client side
        cache_name = user + "_" + repo
        # see if it's in the cache
        commits = memcache.get(cache_name)
        if commits is None:
            repo_commits_url = "%s%s/%s/graphs/participation" % (GITHUB_URL_BASE,
                                                                 user, repo)
            result = urlfetch.fetch(repo_commits_url)
            if result.status_code != 200:
                # !!!
                raise Exception("Could not fetch a repo's commits")
            repo_commits = json.loads(result.content)
            # might use "all" if we want to display that
            commits = repo_commits["owner"]

            # write out to memcache
            if not memcache.add(cache_name, commits, TIMEOUT):
                logging.error("Memcache set failed.")

        self.response.headers['Content-Type'] = "application/json"
        self.response.out.write(json.dumps(commits))

# # get the request token (temporary) and redirect to the authorization page
# class OAuth(webapp.RequestHandler):
#     def get(self):
#         session = get_current_session()
#         # since we're logging in again, kill the current session
#         if session.is_active():
#             session.terminate()

#         # get request token
#         consumer = oauth.Consumer(API_KEY, API_SECRET)
#         client = oauth.Client(consumer)

#         callback_uri = "https://%s.appspot.com/callback" % get_application_id()
#         callback_uri = urllib.quote(callback_uri)
#         request_token_url = TEMP_CRED_URI + "?oauth_callback=%s" % callback_uri
#         resp, content = client.request(request_token_url, "GET")
#         if resp['status'] != '200':
#             raise Exception("Invalid response %s." % resp['status'])

#         # deprecated in 2.6+, use urlparse instead
#         request_token = dict(cgi.parse_qsl(content))

#         oauth_token = request_token['oauth_token']
#         oauth_token_secret = request_token['oauth_token_secret']
#         # set these in session for the callback
#         session['oauth_token'] = oauth_token
#         session['oauth_token_secret'] = oauth_token_secret
#         session['done'] = False

#         # redirect to the auth page
#         self.redirect(OWNER_AUTH_URI + "?oauth_token=%s" % oauth_token)
#     def post(self):
#         self.get()

# # callback endpoint of the OAuth process
# class OAuthCallback(webapp.RequestHandler):
#     def get(self):
#         session = get_current_session()
#         # make sure the session is active
#         if not(session.is_active()):
#             raise Exception("Session is not active")

#         # get the oauth_verifier passed in
#         oauth_verifier = self.request.get("oauth_verifier", None)
#         if not(oauth_verifier):
#             raise Exception("No verifier passed in")

#         # retrieve from session
#         oauth_token = session['oauth_token']
#         oauth_token_secret= session['oauth_token_secret']

#         # create the client
#         token = oauth.Token(oauth_token, oauth_token_secret)
#         token.set_verifier(oauth_verifier)
#         consumer = oauth.Consumer(API_KEY, API_SECRET)
#         client = oauth.Client(consumer, token)

#         token_req = TOKEN_REQUEST_URI
#         resp, content = client.request(token_req + "?", "GET")
#         # deprecated in 2.6+, use urlparse instead
#         access_token = dict(cgi.parse_qsl(content))

#         log = logging.getLogger(__name__)
#         log.info(access_token)

#         oauth_token = access_token['oauth_token']
#         user_id = access_token['edam_userId']
#         shard = access_token["edam_shard"]

#         # store the oauth_token in the session - only temporary data
#         session['oauth_token'] = oauth_token
#         session['shard'] = shard
#         session['done'] = True
#         session['user'] = user_id

#         user = EvernoteUser.get_or_insert(user_id)
#         if not(user.user_id):
#             user.user_id = user_id
#             user.put()

#         self.redirect("/")

application = webapp.WSGIApplication(
    [('/', Index),
     ('/([\w\-]+)/(.+)',Repo),
     ],
    debug=True)

def main():
    run_wsgi_app(application)

if __name__ == "__main__":
    main()
