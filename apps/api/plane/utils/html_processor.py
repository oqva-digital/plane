from io import StringIO
from html.parser import HTMLParser
from bs4 import BeautifulSoup
import re
import markdown


class MLStripper(HTMLParser):
    """
    Markup Language Stripper
    """

    def __init__(self):
        super().__init__()
        self.reset()
        self.strict = False
        self.convert_charrefs = True
        self.text = StringIO()

    def handle_data(self, d):
        self.text.write(d)

    def get_data(self):
        return self.text.getvalue()


def strip_tags(html):
    s = MLStripper()
    s.feed(html)
    return s.get_data()


def html_to_markdown(html):
    """
    Convert HTML content to Markdown format.

    Args:
        html: HTML string to convert

    Returns:
        Markdown formatted string
    """
    if not html or html == "<p></p>":
        return ""

    soup = BeautifulSoup(html, "html.parser")

    def process_element(element):
        """Recursively process HTML elements and convert to markdown."""
        if element.name is None:
            # Text node
            text = str(element)
            return text

        result = []

        # Process children first
        children_text = ""
        for child in element.children:
            children_text += process_element(child)

        tag = element.name.lower()

        # Headings
        if tag in ["h1", "h2", "h3", "h4", "h5", "h6"]:
            level = int(tag[1])
            result.append("\n" + "#" * level + " " + children_text.strip() + "\n")

        # Paragraphs
        elif tag == "p":
            result.append("\n" + children_text.strip() + "\n")

        # Bold
        elif tag in ["strong", "b"]:
            result.append("**" + children_text + "**")

        # Italic
        elif tag in ["em", "i"]:
            result.append("*" + children_text + "*")

        # Strikethrough
        elif tag in ["del", "s", "strike"]:
            result.append("~~" + children_text + "~~")

        # Code (inline)
        elif tag == "code":
            # Check if parent is pre (code block)
            if element.parent and element.parent.name == "pre":
                result.append(children_text)
            else:
                result.append("`" + children_text + "`")

        # Code block
        elif tag == "pre":
            result.append("\n```\n" + children_text.strip() + "\n```\n")

        # Links
        elif tag == "a":
            href = element.get("href", "")
            result.append("[" + children_text + "](" + href + ")")

        # Images
        elif tag == "img":
            src = element.get("src", "")
            alt = element.get("alt", "")
            result.append("![" + alt + "](" + src + ")")

        # Unordered lists
        elif tag == "ul":
            result.append("\n" + children_text)

        # Ordered lists
        elif tag == "ol":
            result.append("\n" + children_text)

        # List items
        elif tag == "li":
            parent = element.parent
            if parent and parent.name == "ol":
                # Get index for ordered list
                siblings = list(parent.children)
                idx = 1
                for i, sibling in enumerate(siblings):
                    if sibling == element:
                        break
                    if hasattr(sibling, "name") and sibling.name == "li":
                        idx += 1
                result.append(str(idx) + ". " + children_text.strip() + "\n")
            else:
                result.append("- " + children_text.strip() + "\n")

        # Blockquote
        elif tag == "blockquote":
            lines = children_text.strip().split("\n")
            quoted = "\n".join("> " + line for line in lines)
            result.append("\n" + quoted + "\n")

        # Line break
        elif tag == "br":
            result.append("  \n")

        # Horizontal rule
        elif tag == "hr":
            result.append("\n---\n")

        # Tables
        elif tag == "table":
            result.append("\n" + children_text + "\n")

        elif tag == "thead":
            result.append(children_text)

        elif tag == "tbody":
            result.append(children_text)

        elif tag == "tr":
            cells = []
            for child in element.children:
                if hasattr(child, "name") and child.name in ["td", "th"]:
                    cells.append(process_element(child).strip())
            row = "| " + " | ".join(cells) + " |"
            # Add header separator after first row in thead
            if element.parent and element.parent.name == "thead":
                separator = "| " + " | ".join(["---"] * len(cells)) + " |"
                result.append(row + "\n" + separator + "\n")
            else:
                result.append(row + "\n")

        elif tag in ["td", "th"]:
            result.append(children_text)

        # Div and span - just pass through content
        elif tag in ["div", "span"]:
            result.append(children_text)

        # Task list (checkbox)
        elif tag == "input":
            input_type = element.get("type", "")
            if input_type == "checkbox":
                checked = element.get("checked") is not None
                result.append("[x] " if checked else "[ ] ")
            else:
                result.append(children_text)

        # Custom components (mention, label, etc.) - extract text content
        elif tag in ["mention-component", "label", "image-component"]:
            result.append(children_text)

        # Default: just return children text
        else:
            result.append(children_text)

        return "".join(result)

    markdown_result = process_element(soup)

    # Clean up multiple newlines
    markdown_result = re.sub(r"\n{3,}", "\n\n", markdown_result)
    # Clean up leading/trailing whitespace
    markdown_result = markdown_result.strip()

    return markdown_result


def is_markdown_content(content):
    """
    Detect if the content is markdown rather than HTML.

    This checks for common markdown patterns that indicate the content
    is raw markdown text rather than proper HTML.

    Args:
        content: String content to analyze

    Returns:
        Boolean indicating if content appears to be markdown
    """
    if not content:
        return False

    # First, check if it looks like HTML by parsing it
    soup = BeautifulSoup(content, "html.parser")

    # Get the text content, preserving line breaks between elements
    text_content = soup.get_text(separator="\n")

    # If there's no text content, it's not markdown
    if not text_content.strip():
        return False

    # Check if the HTML structure is minimal (just wrapping tags like <p>)
    # and the content inside contains markdown patterns
    all_tags = soup.find_all(True)

    # If there are no HTML tags, check the raw content for markdown
    if not all_tags:
        return _has_markdown_patterns(content)

    # Tags that are considered acceptable for markdown detection
    # These include wrapper tags AND inline formatting tags that may
    # have been partially converted by the editor
    acceptable_tags = {
        "p", "div", "span",  # wrapper tags
        "strong", "b",  # bold (already converted)
        "em", "i",  # italic (already converted)
        "br",  # line breaks
    }
    is_acceptable_structure = all(tag.name in acceptable_tags for tag in all_tags)

    if is_acceptable_structure:
        # Check if the text content contains markdown patterns
        return _has_markdown_patterns(text_content)

    return False


def _has_markdown_patterns(text):
    """
    Check if text contains markdown formatting patterns.

    Requires at least 2 different markdown pattern types to be detected
    to avoid false positives from plain text that happens to contain
    characters like dashes or asterisks.

    Args:
        text: Plain text to check for markdown patterns

    Returns:
        Boolean indicating if markdown patterns are detected
    """
    if not text:
        return False

    # Track which pattern types are found
    found_patterns = set()

    # Markdown heading patterns (# Heading)
    heading_pattern = r"^#{1,6}\s+.+"

    # Bold pattern (**text** or __text__)
    bold_pattern = r"\*\*[^*]+\*\*|__[^_]+__"

    # Italic pattern (*text* or _text_) - be careful not to match underscores in words
    italic_pattern = r"(?<!\w)\*[^*]+\*(?!\w)|(?<!\w)_[^_]+_(?!\w)"

    # List patterns - require at least 2 consecutive list items to avoid false positives
    # Matches lines starting with - or * or + followed by space, or numbered lists
    unordered_list_pattern = r"^[\s]*[-*+]\s+.+"
    ordered_list_pattern = r"^[\s]*\d+\.\s+.+"

    # Link pattern [text](url)
    link_pattern = r"\[[^\]]+\]\([^)]+\)"

    # Code block pattern (``` or indented code)
    code_block_pattern = r"```[\s\S]*?```"

    # Inline code pattern (`code`)
    inline_code_pattern = r"`[^`]+`"

    # Blockquote pattern (> text)
    blockquote_pattern = r"^>\s+.+"

    # Check each line for patterns
    list_item_count = 0
    for line in text.split("\n"):
        line = line.strip()
        if re.search(heading_pattern, line):
            found_patterns.add("heading")
        if re.search(unordered_list_pattern, line) or re.search(ordered_list_pattern, line):
            list_item_count += 1
        if re.search(blockquote_pattern, line):
            found_patterns.add("blockquote")

    # Only count lists if there are at least 2 items (avoid single dash false positives)
    if list_item_count >= 2:
        found_patterns.add("list")

    # Check entire text for inline patterns
    if re.search(bold_pattern, text):
        found_patterns.add("bold")
    if re.search(italic_pattern, text):
        found_patterns.add("italic")
    if re.search(link_pattern, text):
        found_patterns.add("link")
    if re.search(inline_code_pattern, text):
        found_patterns.add("inline_code")

    # Check for code blocks
    if re.search(code_block_pattern, text, re.MULTILINE):
        found_patterns.add("code_block")

    # Require at least 2 different pattern types to be confident it's markdown
    # This avoids false positives from plain text with occasional dashes or asterisks
    return len(found_patterns) >= 2


def markdown_to_html(md_content):
    """
    Convert Markdown content to HTML format.

    Args:
        md_content: Markdown string to convert

    Returns:
        HTML formatted string
    """
    if not md_content:
        return "<p></p>"

    # Use the markdown library to convert to HTML
    # Enable common extensions for better compatibility
    html_content = markdown.markdown(
        md_content,
        extensions=[
            "tables",
            "fenced_code",
            "nl2br",
            "sane_lists",
        ],
    )

    # If the result is empty, return default
    if not html_content or not html_content.strip():
        return "<p></p>"

    return html_content


def process_description_html(content):
    """
    Process description_html content.

    If the content appears to be markdown wrapped in minimal HTML,
    convert it to proper HTML first. Handles hybrid content where
    some formatting is already HTML (e.g., <strong>) but other
    markdown syntax remains unconverted (e.g., # headings).

    Args:
        content: The description_html content

    Returns:
        Properly formatted HTML content
    """
    if not content or content == "<p></p>":
        return content

    # Check if the content is markdown wrapped in simple HTML
    if is_markdown_content(content):
        # For hybrid content (mix of HTML formatting and raw markdown),
        # first convert existing HTML to markdown, then convert all to HTML
        # This ensures consistent output
        md_content = html_to_markdown(content)

        # Convert the unified markdown back to HTML
        return markdown_to_html(md_content)

    return content
