from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from chatbot_prototype.api.app import create_app
from chatbot_prototype.model.service import ChatbotService
from chatbot_prototype.model.openai_service import LLMDecision, OpenAIResponder


class ChatbotServiceTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ChatbotService()

    def test_menu_rule_returns_menu_intent(self) -> None:
        prediction = self.service.predict("What vegetarian dishes do you have?")
        self.assertEqual(prediction.intent, "menu")
        self.assertIn("menu", prediction.reply.lower())

    def test_greeting_does_not_attach_menu_preview(self) -> None:
        prediction = self.service.predict("hii")
        self.assertEqual(prediction.intent, "greeting")
        self.assertEqual(prediction.menu_items, [])

    def test_order_tracking_uses_order_id(self) -> None:
        prediction = self.service.predict("Track order HT-1024")
        self.assertEqual(prediction.intent, "order_status")
        self.assertIn("HT-1024", prediction.reply)
        self.assertIn("out for delivery", prediction.reply.lower())

    def test_session_memory_reuses_order_id(self) -> None:
        first = self.service.predict("Track order HT-2048")
        second = self.service.predict("Can I cancel it?", session_id=first.session_id)
        self.assertEqual(second.intent, "cancellation_policy")
        self.assertIn("HT-2048", second.reply)

    def test_add_to_cart_returns_cart_payload(self) -> None:
        prediction = self.service.predict("Add 2 Paneer Tikka")
        self.assertEqual(prediction.intent, "order_add")
        self.assertIsNotNone(prediction.cart)
        assert prediction.cart is not None
        self.assertEqual(prediction.cart["itemCount"], 2)
        self.assertEqual(prediction.cart["items"][0]["name"], "Paneer Tikka")

    def test_place_order_creates_trackable_order(self) -> None:
        first = self.service.predict("Add Paneer Tikka")
        second = self.service.predict("Place my order", session_id=first.session_id)
        self.assertEqual(second.intent, "order_checkout")
        self.assertRegex(second.reply, r"HT-\d{4}")
        order_id = second.reply.split(" as ")[1].split(".")[0]
        tracking = self.service.restaurant.get_order(order_id)
        self.assertIsNotNone(tracking)

    def test_faq_query_uses_restaurant_faq_data(self) -> None:
        prediction = self.service.predict("Do you accept reservations?")
        self.assertEqual(prediction.intent, "faq")
        self.assertIn("14 days", prediction.reply)

    def test_help_message_returns_restaurant_guidance(self) -> None:
        prediction = self.service.predict("help me")
        self.assertEqual(prediction.intent, "help")
        self.assertIn("menu browsing", prediction.reply.lower())

    def test_recommendation_message_returns_grounded_menu_suggestions(self) -> None:
        prediction = self.service.predict("I am hungry")
        self.assertEqual(prediction.intent, "recommendation")
        self.assertIn("recommend", prediction.reply.lower())
        self.assertGreater(len(prediction.menu_items), 0)

    def test_about_message_returns_restaurant_summary(self) -> None:
        prediction = self.service.predict("Tell me about your restaurant")
        self.assertEqual(prediction.intent, "about")
        self.assertIn("GTL Utsav Dining", prediction.reply)

    def test_llm_is_preferred_for_general_queries_when_enabled(self) -> None:
        service = ChatbotService(openai_mode="prefer")
        service.openai = Mock()
        service.openai.enabled = True
        service.openai.maybe_reply.return_value = LLMDecision(
            reply="Here is a broader answer from the LLM.",
            used=True,
        )

        prediction = service.predict("What makes your restaurant special?")

        self.assertEqual(prediction.intent, "llm_support")
        self.assertEqual(prediction.source, "openai")
        self.assertIn("broader answer", prediction.reply)

    def test_rule_based_order_flow_still_beats_llm_for_operational_queries(self) -> None:
        service = ChatbotService(openai_mode="prefer")
        service.openai = Mock()
        service.openai.enabled = True

        prediction = service.predict("Track order HT-1024")

        self.assertEqual(prediction.intent, "order_status")
        service.openai.maybe_reply.assert_not_called()


class OpenAIResponderTestCase(unittest.TestCase):
    def test_openai_failure_falls_back_without_crashing(self) -> None:
        responder = OpenAIResponder(api_key="test-key", model="gpt-test")
        failing_client = Mock()
        failing_client.responses.create.side_effect = RuntimeError("boom")

        with patch.object(responder, "_get_client", return_value=failing_client):
            decision = responder.maybe_reply("hello", "ctx", "restaurant")

        self.assertFalse(decision.used)
        self.assertEqual(decision.reply, "")


class FlaskAppTestCase(unittest.TestCase):
    def setUp(self) -> None:
        app = create_app()
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_health_endpoint(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("brand", payload)

    def test_restaurant_endpoint(self) -> None:
        response = self.client.get("/api/restaurant")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertGreater(len(payload["menu"]), 0)
        self.assertGreater(len(payload["branches"]), 0)

    def test_tracking_endpoint(self) -> None:
        response = self.client.get("/api/orders/HT-1024/tracking")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["orderId"], "HT-1024")
        self.assertGreater(len(payload["routePath"]), 1)
        self.assertIsNotNone(payload["restaurantLocation"])

    def test_chat_endpoint_returns_session(self) -> None:
        response = self.client.post("/api/chat", json={"message": "Where are your branches?"})
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["sessionId"])
        self.assertEqual(payload["intent"], "location")

    def test_chat_endpoint_returns_menu_and_cart(self) -> None:
        response = self.client.post("/api/chat", json={"message": "Show the full menu"})
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["intent"], "menu")
        self.assertGreater(len(payload["menuItems"]), 0)


if __name__ == "__main__":
    unittest.main()
