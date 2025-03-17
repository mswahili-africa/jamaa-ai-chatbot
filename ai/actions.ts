import axios from "axios";

const BASE_URL = "https://api.prod.bantu.tz";

type Coordinates = [number, number];

async function getTripEstimate(pickupCoordinates: Coordinates, dropoffCoordinates: Coordinates) {
  try {
    const response = await axios.post(`${BASE_URL}/delivery/trip/estimate`, {
      origins: [pickupCoordinates],
      destinations: [dropoffCoordinates],
    });
    return response.data;
  } catch (error) {
    throw new Error("Failed to get trip estimate");
  }
}

async function requestTrip(pickupCoordinates: Coordinates, dropoffCoordinates: Coordinates, type: string) {
  try {
    const response = await axios.post(`${BASE_URL}/delivery/trip/request`, {
      pickup: pickupCoordinates,
      dropoff: dropoffCoordinates,
      type,
    });
    return response.data;
  } catch (error) {
    throw new Error("Failed to request trip");
  }
}

export async function requestRide({ pickupCoordinates, dropoffCoordinates }: { pickupCoordinates: Coordinates; dropoffCoordinates: Coordinates }) {
  const estimate = await getTripEstimate(pickupCoordinates, dropoffCoordinates);
  const rideRequest = await requestTrip(pickupCoordinates, dropoffCoordinates, "ride");

  return {
    driverName: rideRequest.driver.name,
    vehicleDetails: rideRequest.vehicle.details,
    estimatedTimeOfArrival: rideRequest.eta,
    priceInTZS: estimate.fee,
  };
}

export async function requestDelivery({ pickupCoordinates, deliveryCoordinates, packageDetails }: { pickupCoordinates: Coordinates; deliveryCoordinates: Coordinates; packageDetails: any }) {
  const estimate = await getTripEstimate(pickupCoordinates, deliveryCoordinates);
  const deliveryRequest = await requestTrip(pickupCoordinates, deliveryCoordinates, "delivery");

  return {
    courierName: deliveryRequest.courier.name,
    vehicleDetails: deliveryRequest.vehicle.details,
    estimatedDeliveryTime: deliveryRequest.eta,
    priceInTZS: estimate.fee,
  };
}