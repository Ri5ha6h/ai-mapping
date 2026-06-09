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
  2,
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
  2,
)

export const SAMPLE_TARGET_XML = `<ShipmentEvent>
  <TrackingNumber></TrackingNumber>
  <Carrier></Carrier>
  <StatusCode></StatusCode>
  <StatusDescription></StatusDescription>
  <EventTimestamp></EventTimestamp>
  <City></City>
  <Country></Country>
</ShipmentEvent>`

export const SAMPLE_SOURCE_XML = `<Shipment>
  <TrackingNumber>TRK123</TrackingNumber>
  <Carrier>MAERSK</Carrier>
  <Status>
    <Code>X3</Code>
    <Description>Arrived at pickup location</Description>
  </Status>
  <EventTime>20260608</EventTime>
  <Location>
    <City>Mumbai</City>
    <Country>IN</Country>
  </Location>
</Shipment>`

export const SAMPLE_EDI_214 = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260608*1030*U*00401*000000001*0*T*>~
GS*QM*SENDER*RECEIVER*20260608*1030*1*X*004010~
ST*214*0001~
B10*REF123*TRK123*MAERSK~
L11*ORDER123*BM~
AT7*X3*NS***20260608*1030*LT~
MS1*Mumbai*MH*IN~
SE*6*0001~
GE*1*1~
IEA*1*000000001~`

export const SAMPLE_EDI_856 = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260608*1030*U*00401*000000002*0*T*>~
GS*SH*SENDER*RECEIVER*20260608*1030*2*X*004010~
ST*856*0002~
BSN*00*SHIP123*20260608*1030~
HL*1**S~
TD5*B*2*MAERSK*M~
REF*BM*ORDER123~
DTM*011*20260608~
HL*2*1*O~
PRF*PO12345~
HL*3*2*I~
LIN**BP*ITEM001~
SN1**10*EA~
SE*11*0002~
GE*1*2~
IEA*1*000000002~`
