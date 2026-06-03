import { useEffect, useState, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePostHog } from "posthog-js/react";

const PRODUCTS = {
  subscription: { label: "Subscription signup", fields: ["email", "plan"] },
  profile: { label: "Profile setup", fields: ["display_name", "avatar_choice"] },
  payment: { label: "Payment method", fields: ["card_last4", "billing_country"] },
  watchlist: { label: "Add to watchlist", fields: ["title_id", "notify_preference"] },
} as const;

type ProductKey = keyof typeof PRODUCTS;

const isProductKey = (value: string | undefined): value is ProductKey =>
  !!value && value in PRODUCTS;

const ProductForm = () => {
  const { product } = useParams<{ product: string }>();
  const navigate = useNavigate();
  const posthog = usePostHog();

  const productKey: ProductKey = isProductKey(product) ? product : "subscription";
  const config = PRODUCTS[productKey];

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    posthog?.capture("start_form", {
      product_id: productKey,
      form_id: `${productKey}_form_v1`,
    });
  }, [posthog, productKey]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    posthog?.capture("finish_form", {
      product_id: productKey,
      form_id: `${productKey}_form_v1`,
    });

    setTimeout(() => navigate("/forms/done"), 400);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-background">
      <form
        onSubmit={handleSubmit}
        className="bg-card text-card-foreground shadow rounded-lg p-8 max-w-md w-full border"
      >
        <h1 className="text-2xl font-semibold mb-2">{config.label}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          product_id: <code>{productKey}</code>
        </p>
        {config.fields.map((field) => (
          <div key={field} className="mb-4">
            <label className="block text-sm font-medium mb-1" htmlFor={field}>
              {field}
            </label>
            <input
              id={field}
              type="text"
              name={field}
              required
              className="w-full border rounded px-3 py-2 bg-background"
              data-testid={`field-${field}`}
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={submitting}
          data-testid="submit-button"
          className="w-full bg-primary text-primary-foreground py-2 rounded disabled:opacity-50 hover:opacity-90"
        >
          {submitting ? "Submitting…" : `Complete ${config.label}`}
        </button>
      </form>
    </main>
  );
};

export default ProductForm;
