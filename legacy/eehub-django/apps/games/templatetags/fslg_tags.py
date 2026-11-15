from django import template

from accounts.access import is_super_admin

register = template.Library()


@register.simple_tag(takes_context=True)
def fslg_super(context):
    """True for the super admin (accounts.access): Arcade Management shows the FSLG editors only to them."""
    req = context.get("request")
    return bool(req is not None and is_super_admin(getattr(req, "user", None)))
