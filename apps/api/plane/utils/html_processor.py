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

    # Get the text content
    text_content = soup.get_text()

    # If there's no text content, it's not markdown
    if not text_content.strip():
        return False

    # Check if the HTML structure is minimal (just wrapping tags like <p>)
    # and the content inside contains markdown patterns
    all_tags = soup.find_all(True)

    # If there are no HTML tags, check the raw content for markdown
    if not all_tags:
        return _has_markdown_patterns(content)

    # If the HTML is just a simple wrapper (like <p>content</p>),
    # check if the inner text has markdown patterns
    wrapper_tags = {"p", "div", "span"}
    is_simple_wrapper = all(tag.name in wrapper_tags for tag in all_tags)

    if is_simple_wrapper:
        # Check if the text content contains markdown patterns
        return _has_markdown_patterns(text_content)

    return False


def _has_markdown_patterns(text):
    """
    Check if text contains markdown formatting patterns.

    Args:
        text: Plain text to check for markdown patterns

    Returns:
        Boolean indicating if markdown patterns are detected
    """
    if not text:
        return False

    # Markdown heading patterns (# Heading)
    heading_pattern = r"^#{1,6}\s+.+"

    # Bold pattern (**text** or __text__)
    bold_pattern = r"\*\*[^*]+\*\*|__[^_]+__"

    # Italic pattern (*text* or _text_) - be careful not to match underscores in words
    italic_pattern = r"(?<!\w)\*[^*]+\*(?!\w)|(?<!\w)_[^_]+_(?!\w)"

    # List patterns (- item or * item or 1. item)
    list_pattern = r"^[\s]*[-*+]\s+.+|^[\s]*\d+\.\s+.+"

    # Link pattern [text](url)
    link_pattern = r"\[[^\]]+\]\([^)]+\)"

    # Code block pattern (``` or indented code)
    code_block_pattern = r"```[\s\S]*?```"

    # Inline code pattern (`code`)
    inline_code_pattern = r"`[^`]+`"

    # Blockquote pattern (> text)
    blockquote_pattern = r"^>\s+.+"

    patterns = [
        heading_pattern,
        bold_pattern,
        italic_pattern,
        list_pattern,
        link_pattern,
        code_block_pattern,
        inline_code_pattern,
        blockquote_pattern,
    ]

    # Check each line for multiline patterns
    for line in text.split("\n"):
        line = line.strip()
        if re.search(heading_pattern, line, re.MULTILINE):
            return True
        if re.search(list_pattern, line, re.MULTILINE):
            return True
        if re.search(blockquote_pattern, line, re.MULTILINE):
            return True

    # Check entire text for inline patterns
    for pattern in [bold_pattern, italic_pattern, link_pattern, inline_code_pattern]:
        if re.search(pattern, text):
            return True

    # Check for code blocks
    if re.search(code_block_pattern, text, re.MULTILINE):
        return True

    return False


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
    convert it to proper HTML first.

    Args:
        content: The description_html content

    Returns:
        Properly formatted HTML content
    """
    if not content or content == "<p></p>":
        return content

    # Check if the content is markdown wrapped in simple HTML
    if is_markdown_content(content):
        # Extract the text content (strip HTML wrappers)
        soup = BeautifulSoup(content, "html.parser")
        text_content = soup.get_text()

        # Convert markdown to HTML
        return markdown_to_html(text_content)

    return content
