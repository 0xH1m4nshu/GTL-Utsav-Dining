from __future__ import annotations

import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from prepare_hybrid_dataset import build_dataset, infer_intent, load_dailydialog, load_sgd_from_zip


class HybridDatasetPreparationTestCase(unittest.TestCase):
    def test_infer_intent_for_human_like_questions(self) -> None:
        self.assertEqual(infer_intent("hii"), "greeting")
        self.assertEqual(infer_intent("I am hungry, suggest something"), "menu")
        self.assertEqual(infer_intent("Book a table for 4"), "reservation")

    def test_build_dataset_combines_daily_dialog_taskmaster_and_sgd(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)

            dailydialog_dir = root / "dailydialog"
            dailydialog_dir.mkdir(parents=True)
            (dailydialog_dir / "dialogues_text.txt").write_text(
                "hello __eou__ hi there __eou__ i am hungry __eou__ try paneer tikka __eou__",
                encoding="utf-8",
            )

            taskmaster_dir = root / "taskmaster"
            taskmaster_dir.mkdir(parents=True)
            (taskmaster_dir / "sample.json").write_text(
                json.dumps(
                    [
                        {
                            "utterances": [
                                {"speaker": "USER", "text": "book a table for 2"},
                                {"speaker": "ASSISTANT", "text": "Sure, what time would you like?"},
                            ]
                        }
                    ]
                ),
                encoding="utf-8",
            )

            sgd_dir = root / "sgd"
            sgd_dir.mkdir(parents=True)
            (sgd_dir / "dialogues_001.json").write_text(
                json.dumps(
                    [
                        {
                            "services": ["Restaurants_1"],
                            "turns": [
                                {"speaker": "USER", "utterance": "where are you located?"},
                                {"speaker": "SYSTEM", "utterance": "We are on MG Road, Camp, Pune."},
                            ],
                        }
                    ]
                ),
                encoding="utf-8",
            )

            df = build_dataset(root)

        self.assertEqual(set(df["source"]), {"dailydialog", "taskmaster", "sgd"})
        self.assertIn("instruction", df.columns)
        self.assertIn("intent", df.columns)
        self.assertIn("response", df.columns)

    def test_build_dataset_reads_huggingface_dailydialog_jsonl(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dailydialog_dir = Path(temp_dir) / "dailydialog"
            dailydialog_dir.mkdir(parents=True)
            (dailydialog_dir / "train.jsonl").write_text(
                json.dumps(
                    {
                        "id": "sample-1",
                        "utterances": ["hello", "hi there", "i am hungry", "try paneer tikka"],
                        "acts": [1, 1, 1, 1],
                        "emotions": [0, 0, 0, 0],
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            rows = load_dailydialog(dailydialog_dir)

        self.assertTrue(rows)
        self.assertEqual({row.source for row in rows}, {"dailydialog"})
        self.assertGreaterEqual(len(rows), 2)

    def test_load_dailydialog_reads_train_validation_test_text_layout(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            for split, filename in (
                ("train", "dialogues_train.txt"),
                ("validation", "dialogues_validation.txt"),
                ("test", "dialogues_test.txt"),
            ):
                split_dir = root / split
                split_dir.mkdir(parents=True)
                (split_dir / filename).write_text(
                    "hello __eou__ hi there __eou__",
                    encoding="utf-8",
                )

            rows = load_dailydialog(root)

        self.assertGreaterEqual(len(rows), 3)

    def test_load_sgd_from_zip_reads_restaurant_dialogues(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = Path(temp_dir) / "SGD.zip"
            payload = [
                {
                    "services": ["Restaurants_1"],
                    "turns": [
                        {"speaker": "USER", "utterance": "book a table for 2"},
                        {"speaker": "SYSTEM", "utterance": "Sure, what time would you like?"},
                    ],
                }
            ]
            with zipfile.ZipFile(zip_path, "w") as archive:
                archive.writestr(
                    "dstc8-schema-guided-dialogue-master/train/dialogues_001.json",
                    json.dumps(payload),
                )

            rows = load_sgd_from_zip(zip_path)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].source, "sgd")


if __name__ == "__main__":
    unittest.main()
