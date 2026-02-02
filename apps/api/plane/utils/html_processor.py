from io import StringIO
from html.parser import HTMLParser
from bs4 import BeautifulSoup
import re


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

    markdown = process_element(soup)

    # Clean up multiple newlines
    markdown = re.sub(r"\n{3,}", "\n\n", markdown)
    # Clean up leading/trailing whitespace
    markdown = markdown.strip()

    return markdown
