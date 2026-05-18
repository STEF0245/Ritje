/**
 * @file Email notifications for ride invitations.
 * @brief Sends emails to passengers about ride suggestions.
 */

import { sendEmail } from '../utils/email.util.js'
import { getAllUsers } from './user-markers.service.js'

/**
 * @brief Maps a schedule hour to human-readable time label.
 * @param {number} hour - Schedule slot (1-8).
 * @param {boolean} isStart - Whether it's a start time (vs end time).
 * @returns {string|null} - Time label like "8:25" or null if invalid.
 */
export const getHourLabel = (hour, isStart) => {
	const hourMap = {
		1: ['8:25', '9:15'],
		2: ['9:15', '10:20'],
		3: ['10:20', '11:10'],
		4: ['11:10', '12:00'],
		5: ['13:00', '13:50'],
		6: ['13:50', '14:40'],
		7: ['14:55', '15:45'],
		8: ['15:45', '16:35']
	}

	if (!hour) return null
	const key = String(hour)
	const [start, end] = hourMap[key] || []
	return isStart ? start : end
}

/**
 * @brief Generates HTML email content for a ride invitation.
 * @param {object} recipient - Recipient user object.
 * @param {object} driver - Driver user object.
 * @param {string} dayName - Day name (e.g., "Maandag").
 * @param {string} hourLabel - Time label (e.g., "8:25").
 * @param {number} day - Day index.
 * @param {number} hour - Hour index.
 * @returns {string} - HTML email content.
 */
export const generateEmailHtml = (
	recipient,
	driver,
	dayName,
	hourLabel,
	day,
	hour
) => {
	const driverName = driver?.name?.full || 'Een collega'
	const rideUrl = `https://ritje.tech/ride/${day}/${hour}` // TODO: Use dynamic base URL

	// Theme colors
	const bg900 = '#0b0f14'
	const bg800 = '#1c2430'
	const border = '#3a4658'
	const text = '#e6edf7'
	const muted = '#9ca3af'
	const accent = '#3b82f6'

	return `
<!DOCTYPE html>
<html lang="nl">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #f5f5f5;">
	<div style="max-width: 600px; margin: 20px auto; padding: 0 15px;">
		<div style="background-color: ${bg900}; border: 1px solid ${border}; border-radius: 10px; overflow: hidden;">
			
			<!-- Header -->
			<div style="background-color: ${bg800}; padding: 30px; border-bottom: 1px solid ${border};">
				<div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 700; color: ${muted}; margin-bottom: 10px;">Ritje</div>
				<h1 style="font-size: 28px; font-weight: 900; margin: 0 0 8px 0; letter-spacing: -0.02em; color: ${text};">Nieuw Ritvoorstel</h1>
				<p style="font-size: 14px; color: ${muted}; margin: 0; line-height: 1.5;">Een nieuw ritvoorstel voor jou</p>
			</div>

			<!-- Content -->
			<div style="padding: 30px;">
				
				<!-- Greeting -->
				<p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: ${text};">
					Hallo <strong>${recipient.name?.first || 'deelnemer'}</strong>,
				</p>

				<!-- Message -->
				<p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${text};">
					Goed nieuws! <strong>${driverName}</strong> heeft een nieuw ritvoorstel gemaakt waarbij jouw locatie is opgenomen als mogelijke opstapplaats.
				</p>

				<!-- Details -->
				<div style="background-color: ${bg800}; border: 1px solid ${border}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
					<div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 700; color: ${accent}; margin-bottom: 16px;">Ritdetails</div>
					
					<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
						<tr>
							<td style="padding: 8px 0 12px 0; color: ${muted}; font-weight: 600; width: 100px;">Dag:</td>
							<td style="padding: 8px 0 12px 0; color: ${text}; font-weight: 600;">${dayName}</td>
						</tr>
						<tr>
							<td style="padding: 8px 0 12px 0; color: ${muted}; font-weight: 600;">Tijdstip:</td>
							<td style="padding: 8px 0 12px 0; color: ${text}; font-weight: 600;">${hourLabel}</td>
						</tr>
						<tr>
							<td style="padding: 8px 0; color: ${muted}; font-weight: 600;">Bestuurder:</td>
							<td style="padding: 8px 0; color: ${text}; font-weight: 600;">${driverName}</td>
						</tr>
					</table>
				</div>

				<!-- Action Info -->
				<p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${muted};">
					Je kunt het volledige ritvoorstel op de ritpagina bekijken. Daar kun je het voorstel accepteren of weigeren.
				</p>

				<!-- Buttons -->
				<table style="width: 100%; border-collapse: collapse;">
					<tr>
						<td style="padding: 8px 0;">
							<a href="${rideUrl}" style="display: block; background-color: ${accent}; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; text-align: center; font-size: 15px; border: 1px solid ${accent};">
								Bekijk Ritvoorstel
							</a>
						</td>
					</tr>
					<tr>
						<td style="padding: 8px 0;">
							<a href="${rideUrl}/reject" style="display: block; background-color: transparent; color: ${text}; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; font-size: 14px; border: 1px solid ${border};">
								Weiger
							</a>
						</td>
					</tr>
				</table>
			</div>

			<!-- Footer -->
			<div style="background-color: ${bg800}; border-top: 1px solid ${border}; padding: 20px 30px; text-align: center;">
				<p style="margin: 0; font-size: 12px; color: ${muted}; line-height: 1.5;">
					© ${new Date().getFullYear()} Ritje • Slim samen reizen naar school
				</p>
			</div>
		</div>
	</div>
</body>
</html>
	`
}

export const generateCancellationEmailHtml = (
	recipient,
	driver,
	dayName,
	hourLabel,
	day,
	hour
) => {
	const driverName = driver?.name?.full || 'Een collega'
	const rideUrl = `https://ritje.tech/ride/${day}/${hour}` // TODO: Use dynamic base URL

	// Theme colors
	const bg900 = '#0b0f14'
	const bg800 = '#1c2430'
	const border = '#3a4658'
	const text = '#e6edf7'
	const muted = '#9ca3af'
	const accent = '#3b82f6'

	return `
<!DOCTYPE html>
<html lang="nl">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #f5f5f5;">
	<div style="max-width: 600px; margin: 20px auto; padding: 0 15px;">
		<div style="background-color: ${bg900}; border: 1px solid ${border}; border-radius: 10px; overflow: hidden;">
			
			<!-- Header -->
			<div style="background-color: ${bg800}; padding: 30px; border-bottom: 1px solid ${border};">
				<div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 700; color: ${muted}; margin-bottom: 10px;">Ritje</div>
				<h1 style="font-size: 28px; font-weight: 900; margin: 0 0 8px 0; letter-spacing: -0.02em; color: ${text};">Rit Geannuleerd</h1>
				<p style="font-size: 14px; color: ${muted}; margin: 0; line-height: 1.5;">Een geplande rit is geannuleerd</p>
			</div>

			<!-- Content -->
			<div style="padding: 30px;">
				
				<!-- Greeting -->
				<p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: ${text};">
					Hallo <strong>${recipient.name?.first || 'deelnemer'}</strong>,
				</p>

				<!-- Message -->
				<p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${text};">
					<strong>${driverName}</strong> heeft een ritvoorstel helaas geannuleerd.
				</p>

				<!-- Details -->
				<div style="background-color: ${bg800}; border: 1px solid ${border}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
					<div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 700; color: ${accent}; margin-bottom: 16px;">Geannuleerde Ritdetails</div>
					
					<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
						<tr>
							<td style="padding: 8px 0 12px 0; color: ${muted}; font-weight: 600; width: 100px;">Dag:</td>
							<td style="padding: 8px 0 12px 0; color: ${text}; font-weight: 600;">${dayName}</td>
						</tr>
						<tr>
							<td style="padding: 8px 0 12px 0; color: ${muted}; font-weight: 600;">Tijdstip:</td>
							<td style="padding: 8px 0 12px 0; color: ${text}; font-weight: 600;">${hourLabel}</td>
						</tr>
						<tr>
							<td style="padding: 8px 0; color: ${muted}; font-weight: 600;">Bestuurder:</td>
							<td style="padding: 8px 0; color: ${text}; font-weight: 600;">${driverName}</td>
						</tr>
					</table>
				</div>

				<!-- Action Info -->
				<p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${muted};">
					Je kunt op ons platform zien of er een ander ritvoorstel beschikbaar is op dezelfde dag.
				</p>

				<!-- Buttons -->
				<table style="width: 100%; border-collapse: collapse;">
					<tr>
						<td style="padding: 8px 0;">
							<a href="${rideUrl}" style="display: block; background-color: ${accent}; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; text-align: center; font-size: 15px; border: 1px solid ${accent};">
								Bekijk Details
							</a>
						</td>
					</tr>
				</table>
			</div>

			<!-- Footer -->
			<div style="background-color: ${bg800}; border-top: 1px solid ${border}; padding: 20px 30px; text-align: center;">
				<p style="margin: 0; font-size: 12px; color: ${muted}; line-height: 1.5;">
					© ${new Date().getFullYear()} Ritje • Slim samen reizen naar school
				</p>
			</div>
		</div>
	</div>
</body>
</html>
	`
}

/**
 * @brief Sends ride invitation emails to all suggested passengers.
 * @param {string[]} passengers - UIDs of suggested passengers.
 * @param {string} driverUid - Driver's UID.
 * @param {number} day - Weekday index.
 * @param {number} hour - Schedule slot.
 * @param {boolean} isStart - Whether this is a start time.
 */
export const sendInvitationEmails = async (
	passengers,
	driverUid,
	day,
	hour,
	isStart
) => {
	const users = await getAllUsers()
	const recipientUsers = users.filter(
		(user) =>
			user?.uid && passengers.includes(user.uid) && user.uid !== driverUid
	)

	const dayNames = [
		'Zondag',
		'Maandag',
		'Dinsdag',
		'Woensdag',
		'Donderdag',
		'Vrijdag',
		'Zaterdag'
	]
	const dayName = dayNames[day] || `Dag ${day}`
	const hourLabel = getHourLabel(hour, isStart)
	const driver = users.find((u) => u.uid === driverUid)

	for (const recipient of recipientUsers) {
		console.log(
			`Sending ride invitation to ${recipient.email} for ${dayName} ${hourLabel}`
		)

		await sendEmail({
			to: recipient.email,
			subject: `Ritvoorstel: ${dayName} ${hourLabel}`,
			html: generateEmailHtml(
				recipient,
				driver,
				dayName,
				hourLabel,
				day,
				hour
			)
		})
	}
}

export const sendCancellationEmails = async (
	passengers,
	driverUid,
	day,
	hour
) => {
	console.log(passengers)
	const users = await getAllUsers()
	const recipientUsers = users.filter(
		(user) => user?.uid && passengers[user.uid] && user.uid !== driverUid
	)
	const dayNames = [
		'Zondag',
		'Maandag',
		'Dinsdag',
		'Woensdag',
		'Donderdag',
		'Vrijdag',
		'Zaterdag'
	]
	const dayName = dayNames[day] || `Dag ${day}`
	const hourLabel = getHourLabel(hour, true)
	const driver = users.find((u) => u.uid === driverUid)
	for (const recipient of recipientUsers) {
		console.log(
			`Sending ride cancellation to ${recipient.email} for ${dayName} ${hourLabel}`
		)
		await sendEmail({
			to: recipient.email,
			subject: `Rit geannuleerd: ${dayName} ${hourLabel}`,
			html: generateCancellationEmailHtml(
				recipient,
				driver,
				dayName,
				hourLabel,
				day,
				hour
			)
		})
	}
}
