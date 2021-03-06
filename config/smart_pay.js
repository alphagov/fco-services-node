exports.config = {
	sharedKey: '00000000000000000000000000000000000000000',
	psk: '00000000000000000000000000000000000000000',
	dbEncryptionPassword: process.env['db_encryption_password'],
	dbConnectionString: process.env['db_connection_string'],
	dbCollection: process.env['db_collection'],
	emailCollection: process.env['db_email_collection'],
	etdCollection: process.env['etd_email_collection'],
	basicAuthUsername: process.env['basic_Auth_Username'],
	basicAuthPassword: process.env['basic_Auth_Password'],
	emailUsername: process.env['email_username'],
	emailPassword: process.env['email_password'],
	emailFromAddress: process.env['email_from_address'],
	legalisationOfficeEmailAddress: process.env['legalisation_office_email_address'],
	pspId: 'pspid',
	testMode: process.env['TEST_MODE'],
	notificationSlug: 'pay-legalisation-drop-off',
	accounts: {
		'legalisation-post': {
			pspId: (process.env['smart_pay_legalisation_post_pspid'] || 'pspid'),
			skinCode: (process.env['smart_pay_legalisation_post_skin_code'] || 'skinCode'),
			sharedKey: (process.env['smart_pay_legalisation_post_shared_key'] || '00000000000000000000000000000000000000000'),
			sendAllEmails: (process.env['smart_pay_legalisation_post_send_all_emails'] || 'false')
		},
		'legalisation-drop-off': {
			pspId: (process.env['smart_pay_legalisation_dropoff_pspid'] || 'pspid'),
			skinCode: (process.env['smart_pay_legalisation_dropoff_skin_code'] || 'skinCode'),
			sharedKey: (process.env['smart_pay_legalisation_dropoff_shared_key'] || '00000000000000000000000000000000000000000'),
			sendAllEmails: (process.env['smart_pay_legalisation_dropoff_send_all_emails'] || 'false')
		},
		'birth-death-marriage': {
			pspId: (process.env['smart_pay_birth_pspid'] || 'pspid'),
			skinCode: (process.env['smart_pay_birth_skin_code'] || 'skinCode'),
			sharedKey: (process.env['smart_pay_birth_shared_key'] || '00000000000000000000000000000000000000000'),
			sendAllEmails: (process.env['smart_pay_birth_send_all_emails'] || 'false')
		}
	}
};