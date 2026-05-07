package com.digitalpersona.onetouch.ui.swing.sample.Enrollment;


import com.digitalpersona.onetouch.*;
import com.digitalpersona.onetouch.verification.*;
import java.awt.*;
import javax.swing.JOptionPane;
import user.capture_face;
import user.userHome;
//import userHome;

public class VerificationForm extends CaptureForm
{
   public static String user="";
	private DPFPVerification verificator = DPFPGlobal.getVerificationFactory().createVerification();
	
	public VerificationForm(Frame owner) {
           // this.user=user;
		super(owner);
	}
	
	@Override protected void init()
	{
		super.init();
		this.setTitle("Fingerprint Enrollment");
		updateStatus(0);
	}

	@Override protected void process(DPFPSample sample) {
		super.process(sample);

		// Process the sample and create a feature set for the enrollment purpose.
		DPFPFeatureSet features = extractFeatures(sample, DPFPDataPurpose.DATA_PURPOSE_VERIFICATION);

		// Check quality of the sample and start verification if it's good
		if (features != null)
		{
			// Compare the feature set with our template
			DPFPVerificationResult result = verificator.verify(features, ((MainForm)getOwner()).getTemplate());
			updateStatus(result.getFalseAcceptRate());
			if (result.isVerified()){
				//makeReport("The fingerprint was VERIFIED.");
                        System.out.println("finget print verified user....");
                    //new userHome().
                        setVisible(false);
                        super.stop();
                        new capture_face(user).setVisible(true);
                      //  new userHome(user).setVisible(true);
                       // System.exit(0);
                        
                       this.hide();
                        }
                        else{
				makeReport("The fingerprint was NOT VERIFIED.");
                                JOptionPane.showMessageDialog(null,"Finger Print Not Verified..");
                                System.out.println("Finger print not verified ...sorry");
                               // System.exit(0);
                        }
		}
	}
	
	private void updateStatus(int FAR)
	{
		// Show "False accept rate" value
		setStatus(String.format("False Accept Rate (FAR) = %1$s", FAR));
	}

}
