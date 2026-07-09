export const SAMPLE_SOURCE_JSON = JSON.stringify(
  {
    shipment: {
      trackingNumber: "TRK123",
      carrier: "MAERSK",
      status: { code: "X3", description: "Arrived at pickup location" },
      eventTime: "20260608",
      location: { city: "Mumbai", country: "IN" },
    },
  },
  null,
  2
)

export const SAMPLE_TARGET_JSON = JSON.stringify(
  {
    tracking: { number: "", carrierCode: "" },
    event: {
      statusCode: "",
      statusDescription: "",
      timestamp: "",
      city: "",
      country: "",
    },
  },
  null,
  2
)
