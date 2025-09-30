// backend/src/utils/emailService.js
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Send reservation confirmation email
export async function sendReservationConfirmation(email, reservationDetails) {
  const { graveId, garden, row, column, clientName, status } = reservationDetails;
  
  const emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reservation Confirmation - Garden of Memories</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <h1 style="color: #212529; margin: 0 0 8px 0; font-size: 24px; font-weight: 600; letter-spacing: -0.02em;">Garden of Memories</h1>
          <p style="color: #6c757d; margin: 0; font-size: 14px; font-weight: 400;">Memorial Park</p>
        </div>

        <!-- Main content -->
        <div style="padding: 40px 40px 20px 40px;">
          <h2 style="color: #212529; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Reservation Submitted</h2>
          <p style="color: #6c757d; font-size: 16px; margin: 0 0 32px 0;">Dear ${clientName}, your grave plot reservation has been successfully submitted and is pending review.</p>

          <!-- Reservation Details -->
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin: 32px 0;">
            <h3 style="color: #212529; margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">Reservation Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6c757d; font-size: 14px; font-weight: 500;">Grave Location:</td>
                <td style="padding: 8px 0; color: #212529; font-size: 14px; text-align: right; font-weight: 600;">
                  Garden ${garden}, Row ${row}, Column ${column}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6c757d; font-size: 14px; font-weight: 500;">Grave ID:</td>
                <td style="padding: 8px 0; color: #212529; font-size: 14px; text-align: right; font-family: 'SF Mono', Monaco, monospace;">
                  ${graveId}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6c757d; font-size: 14px; font-weight: 500;">Status:</td>
                <td style="padding: 8px 0; text-align: right;">
                  <span style="background-color: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 4px; font-size: 13px; font-weight: 600; text-transform: uppercase;">
                    ${status}
                  </span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Next Steps -->
          <div style="background-color: #e7f3ff; border-radius: 8px; padding: 24px; margin: 32px 0; border-left: 3px solid #0066cc;">
            <h3 style="color: #212529; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">What happens next?</h3>
            <ol style="color: #495057; margin: 0; padding-left: 20px; font-size: 14px;">
              <li style="margin-bottom: 6px;">Our staff will review your reservation and payment proof</li>
              <li style="margin-bottom: 6px;">You will receive an email notification within 24-48 hours</li>
              <li style="margin-bottom: 6px;">Upon approval, the plot will be officially reserved for you</li>
              <li>You can track your reservation status in your account dashboard</li>
            </ol>
          </div>

          <!-- Important Notice -->
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <h4 style="color: #856404; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Important</h4>
            <p style="color: #856404; margin: 0; font-size: 13px;">Please ensure your contact information is up to date so we can reach you regarding your reservation. If you have any questions, please contact us.</p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 24px 40px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; margin: 0 0 8px 0; font-size: 13px;">© 2024 Garden of Memories Memorial Park</p>
          <p style="color: #adb5bd; margin: 0; font-size: 12px;">Pateros, Philippines</p>
          <div style="margin-top: 16px;">
            <a href="mailto:${process.env.EMAIL_FROM}" style="color: #495057; text-decoration: none; font-size: 13px; font-weight: 500;">Contact Support</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const encodedMessage = Buffer.from(
      `To: ${email}\r\n` +
      `From: ${process.env.EMAIL_FROM}\r\n` +
      `Subject: Grave Plot Reservation Confirmation - Garden of Memories\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
      emailContent
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`Reservation confirmation email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending reservation confirmation email:', error);
    return { success: false, error: error.message };
  }
}

// Send reservation status update email (approved/rejected)
export async function sendReservationStatusUpdate(email, reservationDetails) {
  const { graveId, garden, row, column, clientName, status, rejectionReason } = reservationDetails;
  
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  
  const emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reservation ${status === 'approved' ? 'Approved' : 'Update'} - Garden of Memories</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <h1 style="color: #212529; margin: 0 0 8px 0; font-size: 24px; font-weight: 600; letter-spacing: -0.02em;">Garden of Memories</h1>
          <p style="color: #6c757d; margin: 0; font-size: 14px; font-weight: 400;">Memorial Park</p>
        </div>

        <!-- Main content -->
        <div style="padding: 40px 40px 20px 40px;">
          <h2 style="color: #212529; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
            Reservation ${isApproved ? 'Approved' : isRejected ? 'Update' : 'Status Update'}
          </h2>
          <p style="color: #6c757d; font-size: 16px; margin: 0 0 32px 0;">
            Dear ${clientName}, ${isApproved 
              ? 'your grave plot reservation has been approved!' 
              : isRejected 
                ? 'we have an update regarding your reservation.' 
                : 'your reservation status has been updated.'}
          </p>

          <!-- Reservation Details -->
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin: 32px 0;">
            <h3 style="color: #212529; margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">Reservation Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6c757d; font-size: 14px; font-weight: 500;">Grave Location:</td>
                <td style="padding: 8px 0; color: #212529; font-size: 14px; text-align: right; font-weight: 600;">
                  Garden ${garden}, Row ${row}, Column ${column}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6c757d; font-size: 14px; font-weight: 500;">Grave ID:</td>
                <td style="padding: 8px 0; color: #212529; font-size: 14px; text-align: right; font-family: 'SF Mono', Monaco, monospace;">
                  ${graveId}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6c757d; font-size: 14px; font-weight: 500;">Status:</td>
                <td style="padding: 8px 0; text-align: right;">
                  <span style="background-color: ${isApproved ? '#d4edda' : isRejected ? '#f8d7da' : '#fff3cd'}; color: ${isApproved ? '#155724' : isRejected ? '#721c24' : '#856404'}; padding: 4px 12px; border-radius: 4px; font-size: 13px; font-weight: 600; text-transform: uppercase;">
                    ${status}
                  </span>
                </td>
              </tr>
            </table>
          </div>

          ${isApproved ? `
          <!-- Approval Message -->
          <div style="background-color: #d4edda; border-radius: 8px; padding: 24px; margin: 32px 0; border-left: 3px solid #28a745;">
            <h3 style="color: #155724; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">✓ Reservation Approved</h3>
            <p style="color: #155724; margin: 0; font-size: 14px;">Your reservation has been approved. The grave plot is now officially reserved for you. We will contact you regarding the next steps and final payment arrangements.</p>
          </div>
          ` : ''}

          ${isRejected ? `
          <!-- Rejection Message -->
          <div style="background-color: #f8d7da; border-radius: 8px; padding: 24px; margin: 32px 0; border-left: 3px solid #dc3545;">
            <h3 style="color: #721c24; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Reservation Update</h3>
            <p style="color: #721c24; margin: 0 0 12px 0; font-size: 14px;">We regret to inform you that your reservation could not be approved at this time.</p>
            ${rejectionReason ? `
            <div style="background-color: #ffffff; border: 1px solid #f5c6cb; border-radius: 6px; padding: 16px; margin-top: 16px;">
              <p style="color: #6c757d; margin: 0 0 8px 0; font-size: 13px; font-weight: 500;">Reason:</p>
              <p style="color: #721c24; margin: 0; font-size: 14px;">${rejectionReason}</p>
            </div>
            ` : ''}
            <p style="color: #721c24; margin: 16px 0 0 0; font-size: 14px;">Please contact us if you have any questions or would like to make a new reservation.</p>
          </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 24px 40px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; margin: 0 0 8px 0; font-size: 13px;">© 2024 Garden of Memories Memorial Park</p>
          <p style="color: #adb5bd; margin: 0; font-size: 12px;">Pateros, Philippines</p>
          <div style="margin-top: 16px;">
            <a href="mailto:${process.env.EMAIL_FROM}" style="color: #495057; text-decoration: none; font-size: 13px; font-weight: 500;">Contact Support</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const encodedMessage = Buffer.from(
      `To: ${email}\r\n` +
      `From: ${process.env.EMAIL_FROM}\r\n` +
      `Subject: Grave Plot Reservation ${isApproved ? 'Approved' : isRejected ? 'Update' : 'Status Update'} - Garden of Memories\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
      emailContent
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`Reservation ${status} email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending reservation status email:', error);
    return { success: false, error: error.message };
  }
}

export default {
  sendReservationConfirmation,
  sendReservationStatusUpdate
};
