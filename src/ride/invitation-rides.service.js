/**
 * @file Invitation rides query service.
 * @brief Retrieves rides where current user is invited as a passenger.
 */

import db from '../firebase/db.js'
import { isRideCanceled } from './ride-status.util.js'

/**
 * @brief Retrieves all rides the user is invited to for a specific day/hour.
 * @param {string} userUid - Passenger's UID.
 * @param {number} day - Weekday index.
 * @param {number} hour - Schedule slot.
 * @param {Array<object>} users - User list for lookups.
 * @returns {Promise<Array<object>>} - List of invitation rides.
 */
export const getInvitationRides = async (userUid, day, hour, users = []) => {
	const snapshot = await db.ref('rides').once('value')
	const ridesByDriver = snapshot.val() || {}
	const invitationRides = []
	const userLookup = new Map(users.map((user) => [user?.uid, user]))

	for (const [driverUid, driverRides] of Object.entries(ridesByDriver)) {
		if (!driverRides || driverUid === userUid) continue

		for (const [rideKey, ride] of Object.entries(driverRides)) {
			if (!ride) continue
			if (
				Number(ride.day) !== Number(day) ||
				Number(ride.hour) !== Number(hour)
			) {
				continue
			}
			if (!ride.passengers || !ride.passengers[userUid]) continue
			if (isRideCanceled(ride)) continue

			invitationRides.push({
				...ride,
				driver: {
					uid: driverUid,
					name:
						userLookup.get(driverUid)?.name?.full ||
						userLookup.get(driverUid)?.displayName ||
						userLookup.get(driverUid)?.email ||
						driverUid
				},
				rideKey,
				response: ride?.passengers?.[userUid] || null,
				status: ride.status || 'active'
			})
		}
	}

	return invitationRides
}

export const addInvitationStatusToMarkers = (markers, currentRide) => {
	const passengers = currentRide?.passengers || {}
	const invitationRides = Object.entries(passengers).filter(
		([_, status]) => status
	)

	const invitationMap = new Map(
		invitationRides.map(([uid, status]) => [uid, status])
	)

	return markers.map((marker) => {
		const invitation = invitationMap.get(marker.uid)
		if (invitation) {
			return {
				...marker,
				invitation: {
					status: invitation.status,
					label:
						invitation.status === 'accepted'
							? 'Geaccepteerd'
							: invitation.status === 'declined'
								? 'Afgewezen'
								: 'Afwachtend'
				}
			}
		}
		return marker
	})
}
