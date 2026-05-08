import config from '../config.js'
import { Resend } from 'resend'

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
