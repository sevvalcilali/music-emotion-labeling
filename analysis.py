import os

import pandas as pd

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "server", "data")
RESPONSES_PATH = os.path.join(DATA_DIR, "responses.csv")


def main() -> None:
    if not os.path.exists(RESPONSES_PATH) or os.path.getsize(RESPONSES_PATH) == 0:
        print("No responses found.")
        return

    df = pd.read_csv(RESPONSES_PATH)
    if df.empty:
        print("No responses found.")
        return

    summary_by_emotion = (
        df.groupby(["song_index", "emotion"]).size().reset_index(name="count")
    )

    non_mood = df[~df["emotion"].astype(str).str.startswith("mood.")].copy()
    if not non_mood.empty:
        non_mood["level1"] = non_mood["emotion"].astype(str).str.split(".").str[0]
        summary_by_level1 = (
            non_mood.groupby(["song_index", "level1"])\
            .size()\
            .reset_index(name="count")
        )
    else:
        summary_by_level1 = pd.DataFrame(columns=["song_index", "level1", "count"])

    mood_df = df[df["emotion"].astype(str).str.startswith("mood.")].copy()
    if not mood_df.empty:
        summary_by_mood = (
            mood_df.groupby(["song_index", "emotion"])\
            .size()\
            .reset_index(name="count")\
            .rename(columns={"emotion": "mood"})
        )
    else:
        summary_by_mood = pd.DataFrame(columns=["song_index", "mood", "count"])

    summary_by_emotion.to_csv(
        os.path.join(DATA_DIR, "summary_by_emotion.csv"), index=False
    )
    summary_by_level1.to_csv(
        os.path.join(DATA_DIR, "summary_by_level1.csv"), index=False
    )
    summary_by_mood.to_csv(
        os.path.join(DATA_DIR, "summary_by_mood.csv"), index=False
    )

    print("summary_by_emotion.csv")
    print(summary_by_emotion.head())
    print("\nsummary_by_level1.csv")
    print(summary_by_level1.head())
    print("\nsummary_by_mood.csv")
    print(summary_by_mood.head())


if __name__ == "__main__":
    main()
