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

TIMEOUT = 60 # assuming minutes

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
            if not memcache.add("_requests_left", requests_left, TIMEOUT):
                logging.error("Memcache set failed.")
            if result.status_code != 200:
                # !!!
                raise Exception("Could not find a username")
            repos = json.loads(result.content)
            repo_names = [r['name'] for r in repos]

            # !!! MOVE THIS TO THE CLIENT SIDE
            # !!! Cross Origin Resource Sharing for AJAX requests, reg oauth
            # get number of commits for each repo
            # repos = {}
            # for repo in repo_names:
            #     repo_commits_url = \
            #         "%s%s/%s/graphs/participation" % (GITHUB_URL_BASE, 
            #                                           user, repo)
            #     result = urlfetch.fetch(repo_commits_ur)
            #     if result.status_code != 200:
            #         # !!!
            #         raise Exception("Could not fetch a repo's commits")
            #     thing = json.loads(result.content)
            #     # might use "all" if we want to display that
            #     repos[repo] = thing["owner"]

            # data = repos
            # # write out to memcache
            # if not memcache.add(user, data, TIMEOUT):
            #     logging.error("Memcache set failed.")

        self.response.out.write(template.render("templates/graph.html",{}))

    # just reroute back to GET
    def post(self):
        self.get()

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
     ],
    debug=True)

def main():
    run_wsgi_app(application)

if __name__ == "__main__":
    main()
