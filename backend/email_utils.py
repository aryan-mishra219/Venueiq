import os
from mailjet_rest import Client
from dotenv import load_dotenv

load_dotenv()

def send_turn_email(recipient_email, visitor_name, ticket_id):
    """
    Sends a professionally formatted email to the visitor when it's their turn.
    """
    api_key = os.getenv('MAILJET_API_KEY')
    api_secret = os.getenv('MAILJET_API_SECRET')
    sender_email = os.getenv('SENDER_EMAIL', 'no-reply@venueiq.com')
    
    if not api_key or not api_secret:
        print("Skipping email: Mailjet credentials not found in environment.")
        return False

    mailjet = Client(auth=(api_key, api_secret), version='v3.1')
    
    html_content = f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; background-color: #ffffff; color: #333;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 40px 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">It's Your Turn!</h1>
            <p style="margin: 10px 0 0; opacity: 0.9; font-size: 16px;">Welcome to VenueIQ Bharat Experience</p>
        </div>
        
        <div style="padding: 40px 30px;">
            <p style="font-size: 18px; line-height: 1.6;">Hi <strong>{visitor_name}</strong>,</p>
            <p style="font-size: 16px; line-height: 1.6; color: #555;">
                The wait is over! We are delighted to inform you that your turn has arrived. Please proceed to the counter or entrance now.
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 30px 0; border-left: 4px solid #6366f1; text-align: center;">
                <span style="display: block; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px; margin-bottom: 5px;">Your Unique Ticket ID</span>
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 24px; font-weight: 700; color: #1e293b;">{ticket_id}</span>
            </div>
            
            <p style="font-size: 15px; line-height: 1.6; color: #666; font-style: italic;">
                "A wait well-spent is a joy well-earned. Thank you for your patience and for being a part of VenueIQ."
            </p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                <p style="font-size: 14px; color: #94a3b8; margin-bottom: 0;">VenueIQ • Smart Crowd Management</p>
                <p style="font-size: 12px; color: #cbd5e1; margin-top: 5px;">Powered by Real-time Intelligence</p>
            </div>
        </div>
    </div>
    """
    
    data = {
        'Messages': [
            {
                "From": {
                    "Email": sender_email,
                    "Name": "VenueIQ Notifications"
                },
                "To": [
                    {
                        "Email": recipient_email,
                        "Name": visitor_name
                    }
                ],
                "Subject": f"🎉 It's Your Turn, {visitor_name}!",
                "HTMLPart": html_content,
                "TextPart": f"Hi {visitor_name}, it's your turn! Your Ticket ID is {ticket_id}. Please proceed to the entrance."
            }
        ]
    }
    
    try:
        result = mailjet.send.create(data=data)
        if result.status_code == 200:
            print(f"Email sent successfully to {recipient_email}")
            return True
        else:
            print(f"Failed to send email: {result.status_code} - {result.json()}")
            return False
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False
