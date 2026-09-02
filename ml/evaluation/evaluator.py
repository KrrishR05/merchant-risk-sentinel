"""
RiskSūtra — Evaluation Engine

Computes quantitative metrics for risk engine performance:
Precision, Recall, F1-Score, False Positive Rate, Detection Lead Time, and Attack-Chain Recall.
"""

from typing import Optional
from models.schemas import EvaluationMetrics


class RiskEvaluator:
    """
    Evaluation metrics calculator for merchant risk detection.
    """

    def evaluate_predictions(
        self,
        predictions: list[dict],
    ) -> EvaluationMetrics:
        """
        Calculates precision, recall, f1, FPR, lead time, and attack-chain recall.

        predictions format:
        [
            {
                "merchant_id": str,
                "predicted_label": "attack" | "benign",
                "ground_truth_label": "attack" | "benign",
                "predicted_score": float,
                "attack_start_time": datetime or None,
                "detection_time": datetime or None,
                "predicted_chain": list[str],
                "ground_truth_chain": list[str],
            },
            ...
        ]
        """
        tp = 0
        fp = 0
        tn = 0
        fn = 0

        lead_times = []
        chain_recalls = []

        for p in predictions:
            pred = p["predicted_label"]
            gt = p["ground_truth_label"]

            if pred == "attack" and gt == "attack":
                tp += 1

                # Calculate detection lead time (seconds from attack start to detection)
                start_t = p.get("attack_start_time")
                det_t = p.get("detection_time")
                if start_t and det_t and det_t >= start_t:
                    lead_times.append((det_t - start_t).total_seconds())

                # Calculate attack chain recall
                pred_chain = set(p.get("predicted_chain", []))
                gt_chain = set(p.get("ground_truth_chain", []))
                if gt_chain:
                    matched = len(pred_chain.intersection(gt_chain))
                    chain_recalls.append(matched / len(gt_chain))

            elif pred == "attack" and gt == "benign":
                fp += 1
            elif pred == "benign" and gt == "benign":
                tn += 1
            elif pred == "benign" and gt == "attack":
                fn += 1

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

        avg_lead_time = sum(lead_times) / len(lead_times) if lead_times else 0.0
        avg_chain_recall = sum(chain_recalls) / len(chain_recalls) if chain_recalls else 0.0

        return EvaluationMetrics(
            precision=round(precision, 4),
            recall=round(recall, 4),
            f1_score=round(f1, 4),
            false_positive_rate=round(fpr, 4),
            false_positive_count=fp,
            false_negative_count=fn,
            true_positive_count=tp,
            true_negative_count=tn,
            detection_lead_time_seconds=round(avg_lead_time, 2),
            attack_chain_recall=round(avg_chain_recall, 4),
        )
