import unicodedata
def get_display_width(text: str) -> int:
    width = 0
    for char in text:
        if unicodedata.east_asian_width(char) in ('F', 'W'):
            width += 2
        else:
            width += 1
    return width

line1 = "+------------+---------+--------------+-------------------------------------+"
line2 = "| 包名       | 版本    | 归类         | 说明                                |"
print("Line1 length:", get_display_width(line1))
print("Line2 length:", get_display_width(line2))
