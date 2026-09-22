"""
ScamShield — Step 2: Model Training
====================================
Run this in Google Colab AFTER 01_collect_data.py has produced dataset.csv.gz.

Trains a Random Forest classifier on the extracted features, evaluates it,
and exports the model as ONNX for production deployment.

Usage in Colab:
    1. Ensure dataset.csv.gz exists in ./data/
    2. Ensure features.py is in the same directory
    3. Run all cells
    4. Output: model.onnx + feature_names.json + metrics
"""

# ── Cell 1: Install dependencies ─────────────────────────────────────────────
# !pip install -q scikit-learn skl2onnx onnxruntime pandas matplotlib seaborn tqdm

import json
import os
import sys
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for Colab
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    roc_auc_score,
    roc_curve,
    average_precision_score,
)
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from tqdm.auto import tqdm

warnings.filterwarnings("ignore", category=FutureWarning)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else ".")
from features import extract_features, feature_names, FEATURE_NAMES

# ── Cell 2: Configuration ────────────────────────────────────────────────────

DATA_FILE = Path("./data/dataset.csv.gz")
MODEL_DIR = Path("./model")
MODEL_FILE = MODEL_DIR / "model.onnx"
FEATURE_NAMES_FILE = MODEL_DIR / "feature_names.json"
PLOTS_DIR = Path("./plots")

# Model hyperparameters
RANDOM_STATE = 42
TEST_SIZE = 0.15
VAL_SIZE = 0.15  # Of the remaining after test split

# Random Forest config
RF_N_ESTIMATORS = 300
RF_MAX_DEPTH = 20
RF_MIN_SAMPLES_SPLIT = 5
RF_MIN_SAMPLES_LEAF = 2

# ── Cell 3: Load and Process Dataset ─────────────────────────────────────────

def load_and_extract(data_file: Path) -> tuple[np.ndarray, np.ndarray]:
    """Load dataset and extract feature vectors."""
    
    print("📂 Loading dataset...")
    df = pd.read_csv(data_file, compression="gzip")
    print(f"   Rows: {len(df)}")
    print(f"   Phishing: {(df['label'] == 1).sum()}")
    print(f"   Legitimate: {(df['label'] == 0).sum()}")
    
    print("\n⚙️  Extracting features...")
    X_list = []
    y_list = []
    errors = 0
    
    for _, row in tqdm(df.iterrows(), total=len(df), desc="Extracting features"):
        try:
            url = str(row["url"])
            html = str(row.get("html", "")) if pd.notna(row.get("html")) else ""
            content_available = bool(row.get("content_available", False))
            label = int(row["label"])
            
            feats = extract_features(url, html, content_available)
            X_list.append(feats)
            y_list.append(label)
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"   ⚠️  Error on row: {e}")
    
    if errors > 0:
        print(f"   ⚠️  {errors} rows had extraction errors (skipped)")
    
    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int64)
    
    print(f"\n📊 Feature matrix shape: {X.shape}")
    print(f"   Labels shape: {y.shape}")
    print(f"   Feature count: {X.shape[1]} (expected {len(FEATURE_NAMES)})")
    
    # Sanity check
    assert X.shape[1] == len(FEATURE_NAMES), \
        f"Feature count mismatch: got {X.shape[1]}, expected {len(FEATURE_NAMES)}"
    
    return X, y


# ── Cell 4: Train/Val/Test Split ─────────────────────────────────────────────

def split_data(X: np.ndarray, y: np.ndarray):
    """Split into train/validation/test sets (70/15/15)."""
    
    # First split: separate test set
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y,
    )
    
    # Second split: separate validation from training
    val_ratio = VAL_SIZE / (1 - TEST_SIZE)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=val_ratio, random_state=RANDOM_STATE, stratify=y_temp,
    )
    
    print("📊 Data splits:")
    print(f"   Train: {X_train.shape[0]:,} samples  (phish: {(y_train==1).sum():,}, legit: {(y_train==0).sum():,})")
    print(f"   Val:   {X_val.shape[0]:,} samples  (phish: {(y_val==1).sum():,}, legit: {(y_val==0).sum():,})")
    print(f"   Test:  {X_test.shape[0]:,} samples  (phish: {(y_test==1).sum():,}, legit: {(y_test==0).sum():,})")
    
    return X_train, X_val, X_test, y_train, y_val, y_test


# ── Cell 5: Train Random Forest ──────────────────────────────────────────────

def train_model(X_train, y_train, X_val, y_val):
    """Train a Random Forest and evaluate on validation set."""
    
    print("\n" + "=" * 60)
    print("🌲 Training Random Forest Classifier")
    print("=" * 60)
    print(f"   n_estimators:     {RF_N_ESTIMATORS}")
    print(f"   max_depth:        {RF_MAX_DEPTH}")
    print(f"   min_samples_split: {RF_MIN_SAMPLES_SPLIT}")
    print(f"   min_samples_leaf:  {RF_MIN_SAMPLES_LEAF}")
    print()
    
    clf = RandomForestClassifier(
        n_estimators=RF_N_ESTIMATORS,
        max_depth=RF_MAX_DEPTH,
        min_samples_split=RF_MIN_SAMPLES_SPLIT,
        min_samples_leaf=RF_MIN_SAMPLES_LEAF,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        class_weight="balanced",  # Handle any remaining imbalance
    )
    
    clf.fit(X_train, y_train)
    
    # Validation metrics
    y_val_pred = clf.predict(X_val)
    y_val_proba = clf.predict_proba(X_val)[:, 1]
    
    val_acc = accuracy_score(y_val, y_val_pred)
    val_f1 = f1_score(y_val, y_val_pred)
    val_auc = roc_auc_score(y_val, y_val_proba)
    
    print(f"📊 Validation Results:")
    print(f"   Accuracy:  {val_acc:.4f}")
    print(f"   F1 Score:  {val_f1:.4f}")
    print(f"   ROC AUC:   {val_auc:.4f}")
    print()
    print("   Classification Report (Validation):")
    print(classification_report(y_val, y_val_pred, target_names=["Legitimate", "Phishing"]))
    
    # Cross-validation on train+val for robust estimate
    print("🔄 Running 5-fold cross-validation on training data...")
    X_trainval = np.vstack([X_train, X_val])
    y_trainval = np.concatenate([y_train, y_val])
    cv_scores = cross_val_score(clf, X_trainval, y_trainval, cv=5, scoring="f1", n_jobs=-1)
    print(f"   CV F1 scores: {cv_scores}")
    print(f"   CV F1 mean:   {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    
    return clf


# ── Cell 6: Evaluate on Test Set ─────────────────────────────────────────────

def evaluate_model(clf, X_test, y_test):
    """Final evaluation on held-out test set."""
    
    print("\n" + "=" * 60)
    print("🧪 Final Test Set Evaluation")
    print("=" * 60)
    
    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]
    
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)
    ap = average_precision_score(y_test, y_proba)
    
    print(f"   Accuracy:           {acc:.4f}")
    print(f"   F1 Score:           {f1:.4f}")
    print(f"   ROC AUC:            {auc:.4f}")
    print(f"   Average Precision:  {ap:.4f}")
    print()
    print("   Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["Legitimate", "Phishing"]))
    
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    print("   Confusion Matrix:")
    print(f"   [[TN={cm[0,0]:5d}  FP={cm[0,1]:5d}]")
    print(f"    [FN={cm[1,0]:5d}  TP={cm[1,1]:5d}]]")
    
    return {
        "accuracy": float(acc),
        "f1": float(f1),
        "roc_auc": float(auc),
        "avg_precision": float(ap),
        "confusion_matrix": cm.tolist(),
        "y_test": y_test,
        "y_pred": y_pred,
        "y_proba": y_proba,
    }


# ── Cell 7: Plot Visualizations ──────────────────────────────────────────────

def plot_results(clf, metrics, X_test, y_test):
    """Generate evaluation plots."""
    
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    
    y_proba = metrics["y_proba"]
    
    fig, axes = plt.subplots(2, 2, figsize=(14, 12))
    fig.suptitle("ScamShield Phishing Detector — Model Evaluation", fontsize=16, fontweight="bold")
    
    # 1. Confusion Matrix
    ax = axes[0, 0]
    cm = confusion_matrix(y_test, metrics["y_pred"])
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", ax=ax,
                xticklabels=["Legitimate", "Phishing"],
                yticklabels=["Legitimate", "Phishing"])
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title("Confusion Matrix")
    
    # 2. ROC Curve
    ax = axes[0, 1]
    fpr, tpr, _ = roc_curve(y_test, y_proba)
    ax.plot(fpr, tpr, color="#22D3EE", linewidth=2,
            label=f"ROC AUC = {metrics['roc_auc']:.4f}")
    ax.plot([0, 1], [0, 1], "k--", alpha=0.3)
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC Curve")
    ax.legend()
    ax.grid(alpha=0.3)
    
    # 3. Precision-Recall Curve
    ax = axes[1, 0]
    precision, recall, _ = precision_recall_curve(y_test, y_proba)
    ax.plot(recall, precision, color="#10B981", linewidth=2,
            label=f"Avg Precision = {metrics['avg_precision']:.4f}")
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title("Precision-Recall Curve")
    ax.legend()
    ax.grid(alpha=0.3)
    
    # 4. Feature Importances (top 15)
    ax = axes[1, 1]
    importances = clf.feature_importances_
    indices = np.argsort(importances)[-15:]
    names = [FEATURE_NAMES[i] for i in indices]
    ax.barh(range(len(indices)), importances[indices], color="#8B5CF6")
    ax.set_yticks(range(len(indices)))
    ax.set_yticklabels(names, fontsize=9)
    ax.set_xlabel("Importance")
    ax.set_title("Top 15 Feature Importances")
    ax.grid(alpha=0.3, axis="x")
    
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "evaluation.png", dpi=150, bbox_inches="tight")
    plt.show()
    print(f"📊 Plots saved to {PLOTS_DIR / 'evaluation.png'}")


# ── Cell 8: Export to ONNX ────────────────────────────────────────────────────

def export_onnx(clf, n_features: int):
    """Export the trained model to ONNX format."""
    
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
    
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    
    print("\n" + "=" * 60)
    print("📦 Exporting model to ONNX")
    print("=" * 60)
    
    # Define input type
    initial_type = [("input", FloatTensorType([None, n_features]))]
    
    # Convert
    onnx_model = convert_sklearn(
        clf,
        initial_types=initial_type,
        target_opset=12,
        options={id(clf): {"zipmap": False}},  # Return probabilities as arrays
    )
    
    # Save
    with open(MODEL_FILE, "wb") as f:
        f.write(onnx_model.SerializeToString())
    
    # Save feature names
    with open(FEATURE_NAMES_FILE, "w") as f:
        json.dump(FEATURE_NAMES, f, indent=2)
    
    model_size_mb = MODEL_FILE.stat().st_size / (1024 * 1024)
    print(f"   Model saved to: {MODEL_FILE}")
    print(f"   Model size:     {model_size_mb:.2f} MB")
    print(f"   Feature names:  {FEATURE_NAMES_FILE}")
    
    # Verify ONNX model works
    print("\n🔍 Verifying ONNX model...")
    import onnxruntime as ort
    
    session = ort.InferenceSession(str(MODEL_FILE))
    input_name = session.get_inputs()[0].name
    
    # Test with a dummy phishing-like URL
    test_features = np.random.randn(1, n_features).astype(np.float32)
    outputs = session.run(None, {input_name: test_features})
    
    prediction = outputs[0][0]  # Class label
    probabilities = outputs[1][0]  # Probabilities [P(legit), P(phish)]
    
    print(f"   Test prediction:   {prediction}")
    print(f"   Test probabilities: legit={probabilities[0]:.4f}, phish={probabilities[1]:.4f}")
    print("   ✅ ONNX model verification passed!")
    
    return session


# ── Cell 9: Run Full Pipeline ─────────────────────────────────────────────────

def main():
    """Complete training pipeline."""
    
    print("=" * 60)
    print("🛡️  ScamShield — Model Training Pipeline")
    print("=" * 60)
    print()
    
    # 1. Load data and extract features
    if not DATA_FILE.exists():
        print(f"❌ Dataset not found at {DATA_FILE}")
        print("   Run 01_collect_data.py first!")
        return
    
    X, y = load_and_extract(DATA_FILE)
    
    # 2. Split data
    X_train, X_val, X_test, y_train, y_val, y_test = split_data(X, y)
    
    # 3. Train model
    clf = train_model(X_train, y_train, X_val, y_val)
    
    # 4. Evaluate on test set
    metrics = evaluate_model(clf, X_test, y_test)
    
    # 5. Plot results
    plot_results(clf, metrics, X_test, y_test)
    
    # 6. Export to ONNX
    session = export_onnx(clf, X.shape[1])
    
    # 7. Save metrics
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    metrics_save = {k: v for k, v in metrics.items() 
                    if k not in ("y_test", "y_pred", "y_proba")}
    with open(MODEL_DIR / "metrics.json", "w") as f:
        json.dump(metrics_save, f, indent=2)
    
    print("\n" + "=" * 60)
    print("✅ Training Complete!")
    print("=" * 60)
    print(f"\n📁 Output files:")
    print(f"   {MODEL_FILE}              — ONNX model weights")
    print(f"   {FEATURE_NAMES_FILE}  — Feature names")
    print(f"   {MODEL_DIR / 'metrics.json'}       — Test metrics")
    print(f"   {PLOTS_DIR / 'evaluation.png'}    — Evaluation plots")
    print(f"\n🚀 Next steps:")
    print(f"   1. Download model.onnx from {MODEL_DIR}/")
    print(f"   2. Place it in your repo at shield-student-scan/api/model.onnx")
    print(f"   3. Deploy with api/check.py for production serving")


if __name__ == "__main__":
    main()
