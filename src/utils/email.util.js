import config from '../config.js'
import { Resend } from 'resend'
import db from '../firebase/db.js'

const resend = new Resend(config.email.apiKey)

export const sendEmail = async ({ to, subject, html }) => {
	const { data, error } = await resend.emails.send({
		from: `${config.email.name} <${config.email.address}>`,
		to,
		subject,
		html
	})

	if (error) {
		console.error('Error sending email:', error)
		return { success: false, error }
	}

	return { success: true, data }
}

const getEmailForUid = async (uid) => {
	const dbRef = db.ref(`users/${uid}/email`)
	const snapshot = await dbRef.get()
	if (snapshot.exists()) {
		return snapshot.val()
	} else {
		throw new Error(`No email found for UID: ${uid}`)
	}
}

export const sendEmailToUids = async (uids, { subject, html }) => {
	const emailPromises = uids.map((uid) => getEmailForUid(uid))
	const emails = await Promise.all(emailPromises)

	const to = emails.join(', ')
	const { success, data } = await sendEmail({ to, subject, html })

	if (!success) {
		console.error('Failed to send email to UIDs:', uids, 'Error:', data)
		return { success: false, error: data }
	}

	return { success: true, data: data }
}
