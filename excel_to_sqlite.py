import sys
import os
import pandas as pd
import sqlite3
from tkinter import Tk, filedialog, messagebox

def excel_to_sqlite(excel_path):
    base_dir = os.path.dirname(excel_path)
    db_path = os.path.join(base_dir, "judsondb.db")

    # Read Excel file
    df = pd.read_excel(excel_path, engine='openpyxl')

    # Write to SQLite DB
    conn = sqlite3.connect(db_path)
    df.to_sql("pricelist", conn, if_exists="replace", index=False)
    conn.close()

    print(f"Database created: {db_path}")
    print(f"Table 'pricelist' created with columns: {', '.join(df.columns)}")
    messagebox.showinfo("Success", f"Database created at:\n{db_path}")

def select_file():
    root = Tk()
    root.withdraw()  # Hide main window
    file_path = filedialog.askopenfilename(
        title="Select Excel file",
        filetypes=[("Excel Files", "*.xlsx *.xls")]
    )
    return file_path

if __name__ == "__main__":
    if len(sys.argv) > 1:
        excel_file = sys.argv[1]
    else:
        excel_file = select_file()

    if not excel_file or not os.path.isfile(excel_file):
        messagebox.showerror("Error", "No valid Excel file selected.")
        sys.exit(1)

    try:
        excel_to_sqlite(excel_file)
    except Exception as e:
        messagebox.showerror("Error", f"An error occurred:\n{str(e)}")
        sys.exit(1)
