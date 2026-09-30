"""
Driver Behavior Detection - Model Training
-------------------------------------------
Random Forest classifier using ADXL345 accelerometer data.

Classes:
    SLOW
    NORMAL
    AGGRESSIVE

Input:
    AccX, AccY, AccZ, Class, Timestamp

Output:
    model.joblib
    scaler.joblib
    label_encoder.joblib
    feature_columns.json
    metrics.json
"""

import json
import pandas as pd
import numpy as np
import joblib
from pathlib import Path

from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    f1_score,
)

HERE = Path(__file__).parent
DATA_PATH = HERE / "training_data.csv"

RANDOM_STATE = 42

# ADXL345 provides only these 3 axes
RAW_COLUMNS = ["AccX", "AccY", "AccZ"]
TARGET_COLUMN = "Class"

# Window configuration
WINDOW_SIZE = 25
STEP_SIZE = 5

# Last 20% of each recording is used for testing
TEST_HOLDOUT_FRAC = 0.2


def add_magnitudes(df):
    """Calculate total acceleration magnitude."""
    df = df.copy()

    df["AccMag"] = np.sqrt(
        df["AccX"] ** 2 +
        df["AccY"] ** 2 +
        df["AccZ"] ** 2
    )

    return df


# Features calculated for each window
WINDOW_SOURCE_COLUMNS = RAW_COLUMNS + ["AccMag"]

STATS = ["mean", "std", "min", "max", "range"]


def make_windows(df_block, label):
    """
    Create sliding-window features from one continuous recording.
    """

    rows = []

    n = len(df_block)

    for start in range(
        0,
        max(n - WINDOW_SIZE, 0) + 1,
        STEP_SIZE
    ):

        window = df_block.iloc[
            start:start + WINDOW_SIZE
        ]

        if len(window) < WINDOW_SIZE:
            continue

        feat = {}

        # Calculate statistics for each acceleration feature
        for col in WINDOW_SOURCE_COLUMNS:

            vals = window[col].values

            feat[f"{col}_mean"] = vals.mean()
            feat[f"{col}_std"] = vals.std()
            feat[f"{col}_min"] = vals.min()
            feat[f"{col}_max"] = vals.max()
            feat[f"{col}_range"] = vals.max() - vals.min()

        # Jerk proxy
        # Measures how quickly acceleration changes
        feat["AccMag_jerk"] = np.abs(
            np.diff(window["AccMag"].values)
        ).mean()

        feat["Class"] = label

        rows.append(feat)

    return pd.DataFrame(rows)


def main():

    print(f"Loading dataset from {DATA_PATH} ...")

    # Load CSV
    raw = pd.read_csv(DATA_PATH)

    print("\nDataset columns:")
    print(list(raw.columns))

    # Check required columns
    required_columns = RAW_COLUMNS + [TARGET_COLUMN]

    missing = [
        col for col in required_columns
        if col not in raw.columns
    ]

    if missing:
        print("\nERROR: Missing columns:")
        print(missing)
        return

    # Remove missing values
    raw = raw.dropna(
        subset=required_columns
    ).reset_index(drop=True)

    # Add acceleration magnitude
    raw = add_magnitudes(raw)

    # Identify continuous recording blocks
    raw["block_id"] = (
        raw[TARGET_COLUMN] !=
        raw[TARGET_COLUMN].shift()
    ).cumsum()

    print(
        f"\nContiguous recording blocks: "
        f"{raw['block_id'].nunique()}"
    )

    train_frames = []
    test_frames = []

    # Process each recording separately
    for block_id, block_df in raw.groupby("block_id"):

        label = block_df[TARGET_COLUMN].iloc[0]

        block_df = block_df.reset_index(drop=True)

        split_idx = int(
            len(block_df) *
            (1 - TEST_HOLDOUT_FRAC)
        )

        train_part = block_df.iloc[:split_idx]
        test_part = block_df.iloc[split_idx:]

        train_frames.append(
            make_windows(train_part, label)
        )

        test_frames.append(
            make_windows(test_part, label)
        )

    # Combine windows
    train_df = pd.concat(
        train_frames,
        ignore_index=True
    )

    test_df = pd.concat(
        test_frames,
        ignore_index=True
    )

    print(
        f"\nWindowed train examples: "
        f"{len(train_df)}"
    )

    print(
        f"Windowed test examples: "
        f"{len(test_df)}"
    )

    print("\nTrain class balance:")
    print(train_df["Class"].value_counts())

    # Feature columns
    feature_cols = [
        c for c in train_df.columns
        if c != "Class"
    ]

    print(
        f"\nNumber of ML features: "
        f"{len(feature_cols)}"
    )

    # Encode classes
    label_encoder = LabelEncoder()

    label_encoder.fit(
        train_df["Class"]
    )

    print(
        f"Classes: "
        f"{list(label_encoder.classes_)}"
    )

    # Training data
    X_train = train_df[
        feature_cols
    ].values

    y_train = label_encoder.transform(
        train_df["Class"]
    )

    # Testing data
    X_test = test_df[
        feature_cols
    ].values

    y_test = label_encoder.transform(
        test_df["Class"]
    )

    # Scale features
    scaler = StandardScaler()

    X_train_scaled = scaler.fit_transform(
        X_train
    )

    X_test_scaled = scaler.transform(
        X_test
    )

    # Random Forest
    model = RandomForestClassifier(

        n_estimators=300,

        max_depth=None,

        min_samples_split=4,

        min_samples_leaf=2,

        class_weight="balanced",

        random_state=RANDOM_STATE,

        n_jobs=-1,
    )

    print("\nTraining Random Forest...")

    model.fit(
        X_train_scaled,
        y_train
    )

    # Predictions
    y_pred = model.predict(
        X_test_scaled
    )

    # Metrics
    acc = accuracy_score(
        y_test,
        y_pred
    )

    macro_f1 = f1_score(
        y_test,
        y_pred,
        average="macro"
    )

    report = classification_report(
        y_test,
        y_pred,
        target_names=label_encoder.classes_,
        output_dict=True
    )

    cm = confusion_matrix(
        y_test,
        y_pred
    ).tolist()

    # Display results
    print(
        f"\nTest accuracy : {acc:.4f}"
    )

    print(
        f"Test macro-F1 : {macro_f1:.4f}"
    )

    print("\nClassification report:")

    print(
        classification_report(
            y_test,
            y_pred,
            target_names=label_encoder.classes_
        )
    )

    print(
        "Confusion matrix "
        "(rows=true, cols=pred):"
    )

    print(
        np.array(cm)
    )

    # Feature importance
    importances = dict(
        zip(
            feature_cols,
            model.feature_importances_.tolist()
        )
    )

    importances = dict(
        sorted(
            importances.items(),
            key=lambda kv: -kv[1]
        )
    )

    print("\nTop 10 feature importances:")

    for k, v in list(
        importances.items()
    )[:10]:

        print(
            f"  {k:20s} {v:.4f}"
        )

    # Save model
    joblib.dump(
        model,
        HERE / "model.joblib"
    )

    # Save scaler
    joblib.dump(
        scaler,
        HERE / "scaler.joblib"
    )

    # Save label encoder
    joblib.dump(
        label_encoder,
        HERE / "label_encoder.joblib"
    )

    # Save feature order
    with open(
        HERE / "feature_columns.json",
        "w"
    ) as f:

        json.dump(
            feature_cols,
            f,
            indent=2
        )

    # Save metrics
    metrics = {

        "test_accuracy": acc,

        "test_macro_f1": macro_f1,

        "classes":
            label_encoder.classes_.tolist(),

        "window_size":
            WINDOW_SIZE,

        "step_size":
            STEP_SIZE,

        "sensor":
            "ADXL345",

        "axes":
            ["AccX", "AccY", "AccZ"],

        "feature_columns":
            feature_cols,

        "feature_importances":
            importances,

        "classification_report":
            report,

        "confusion_matrix":
            cm,

        "n_train":
            len(X_train),

        "n_test":
            len(X_test),
    }

    with open(
        HERE / "metrics.json",
        "w"
    ) as f:

        json.dump(
            metrics,
            f,
            indent=2
        )

    print(
        f"\nSaved model files to {HERE}"
    )


if __name__ == "__main__":
    main()