/**
 * @file Email dispatch utilities using Resend API.
 * @brief Wraps Resend SDK for sending emails and batch lookups of user emails.
 * @details Provides `sendEmail()` to send a single email via Resend and `sendEmailToUids()` to send batch emails to multiple users by resolving their UIDs to email addresses in the Firebase database.
 */

import config from '../config.js'
import { Resend } from 'resend'
import db from '../firebase/db.js'

const resend = new Resend(config.email.apiKey)

/**
 * @brief  Send a single email through Resend.
 * @details  Wraps the Resend SDK and returns a normalized success flag with either the API response or error payload.
 * @param {{to: string|string[], subject: string, html: string}} options - Email options.
 * @returns {Promise<{success: boolean, data: unknown}>} Send result.
 */
export const sendEmail = async ({ to, subject, html }) => {
	const { data, error } = await resend.emails.send({
		from: `${config.email.name} <${config.email.address}>`,
		to,
		subject,
		html
	})

	if (error) {
		console.error('Error sending email:', error)
		return { success: false, data: error }
	}

	return { success: true, data }
}

/**
 * @brief  Resolve the email address for a user UID.
 * @details  Reads the user email from Realtime Database and throws when the address is missing.
 * @param {string} uid - Firebase user UID.
 * @returns {Promise<string>} User email address.
 * @throws {Error} Throws when no email exists for the UID.
 */
const getEmailForUid = async (uid) => {
	const dbRef = db.ref(`users/${uid}/email`)
	const snapshot = await dbRef.get()
	if (snapshot.exists()) {
		return snapshot.val()
	} else {
		throw new Error(`No email found for UID: ${uid}`)
	}
}

/**
 * @brief  Send one email to each user UID.
 * @details  Resolves all recipient addresses first and then sends a single Resend batch with those addresses.
 * @param {string[]} uids - Recipient user UIDs.
 * @param {{subject: string, html: string}} options - Email content.
 * @returns {Promise<{success: boolean, data: unknown}>} Send result.
 */
export const sendEmailToUids = async (uids, { subject, html }) => {
	const emailPromises = uids.map((uid) => getEmailForUid(uid))
	const to = await Promise.all(emailPromises)

	const { success, data } = await sendEmail({ to, subject, html })

	if (!success) {
		console.error('Failed to send email to emails:', to, 'Error:', data)
		return { success: false, data: data }
	}

	return { success: true, data: data }
}
