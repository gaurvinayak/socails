"""
LinkedIn OAuth 2.0.

Setup in LinkedIn Developer Portal (https://developer.linkedin.com):
  1. Create an app, associate it with a LinkedIn Page
  2. Add "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn" products
  3. Add redirect URI: http://localhost:8002/api/auth/linkedin/callback
  4. Copy Client ID and Client Secret to .env

Scopes used:
  - openid, profile, email — basic profile info
  - w_member_social — post as the member
  - r_organization_social, w_organization_social — read/post as org
  - rw_organization_admin — manage org (needed for some analytics)
"""
import os
import urllib.parse

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8002")
REDIRECT_URI = f"{BACKEND_URL}/api/auth/linkedin/callback"

SCOPES = [
    "openid",
    "profile",
    "email",
    "w_member_social",
    "r_organization_social",
    "w_organization_social",
]


def get_auth_url(state: str) -> str:
    params = {
        "response_type": "code",
        "client_id": os.getenv("LINKEDIN_CLIENT_ID"),
        "redirect_uri": REDIRECT_URI,
        "scope": " ".join(SCOPES),
        "state": state,
    }
    return (
        "https://www.linkedin.com/oauth/v2/authorization?"
        + urllib.parse.urlencode(params)
    )


async def exchange_code(code: str) -> dict:
    """Exchange authorization code for access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": REDIRECT_URI,
                "client_id": os.getenv("LINKEDIN_CLIENT_ID"),
                "client_secret": os.getenv("LINKEDIN_CLIENT_SECRET"),
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        return resp.json()


async def get_user_profile(access_token: str) -> dict:
    """Return the authenticated member's profile using the OpenID userinfo endpoint."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "platform_user_id": data.get("sub"),
            "username": data.get("sub"),
            "display_name": data.get("name", ""),
            "profile_image_url": data.get("picture", ""),
            "email": data.get("email", ""),
        }


async def get_organizations(access_token: str) -> list[dict]:
    """Return organizations where the member has ADMINISTRATOR role."""
    async with httpx.AsyncClient() as client:
        acl_resp = await client.get(
            "https://api.linkedin.com/v2/organizationAcls",
            params={"q": "roleAssignee", "role": "ADMINISTRATOR", "projection": "(elements*(organization~(id,localizedName,logoV2(original~:playableStreams))))"},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if acl_resp.status_code != 200:
            return []

        orgs = []
        for el in acl_resp.json().get("elements", []):
            org = el.get("organization~", {})
            if org:
                pic_url = ""
                try:
                    pic_url = (
                        org["logoV2"]["original~"]["elements"][-1]["identifiers"][0]["identifier"]
                    )
                except (KeyError, IndexError):
                    pass
                orgs.append(
                    {
                        "org_id": str(org.get("id", "")),
                        "name": org.get("localizedName", ""),
                        "logo_url": pic_url,
                    }
                )
        return orgs


async def create_post(author_urn: str, text: str, access_token: str) -> dict:
    """
    Create a text post on behalf of a member or organization.
    author_urn examples:
      - member:   "urn:li:person:{sub}"
      - org page: "urn:li:organization:{org_id}"
    """
    body = {
        "author": author_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.linkedin.com/v2/ugcPosts",
            json=body,
            headers={
                "Authorization": f"Bearer {access_token}",
                "X-Restli-Protocol-Version": "2.0.0",
            },
        )
        resp.raise_for_status()
        return {"post_urn": resp.headers.get("x-restli-id"), **resp.json()}


async def get_post_stats(post_urn: str, access_token: str) -> dict:
    """Fetch share statistics for a UGC post."""
    encoded_urn = urllib.parse.quote(post_urn, safe="")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.linkedin.com/v2/socialMetadata/{encoded_urn}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "X-Restli-Protocol-Version": "2.0.0",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_comments(post_urn: str, access_token: str) -> list[dict]:
    """Fetch comments on a post."""
    encoded_urn = urllib.parse.quote(post_urn, safe="")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.linkedin.com/v2/socialActions/{encoded_urn}/comments",
            headers={
                "Authorization": f"Bearer {access_token}",
                "X-Restli-Protocol-Version": "2.0.0",
            },
        )
        resp.raise_for_status()
        return resp.json().get("elements", [])
