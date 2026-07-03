import Link from "next/link";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";

const gates = [
  {
    name: "ʻĀinapō Gate",
    hours: "4:30 AM – 8:30 PM",
    location: "40.5 mile marker",
    access:
      "Access to Kapāpala Forest Reserve, ʻĀinapō Trail, Halewai Cabin, and Mauna Loa via ʻĀinapō Trail.",
    allowed:
      "Hiking, motor vehicles, horses, leashed dogs, and bicycles on the access road only.",
  },
  {
    name: "Honanui Gate",
    hours: "6:00 AM – 6:00 PM",
    location: "44 mile marker",
    access:
      "Courtesy access to Kaʻū Forest Reserve, used mostly for native hunting and gathering.",
    allowed: "Vehicle access only. No hiking, horses, or bicycles.",
  },
  {
    name: "Wood Valley",
    hours: "6:00 AM – 6:00 PM",
    location: "Off Highway near Wood Valley Road",
    access: "Courtesy access to Kaʻū Forest Reserve through a private road.",
    allowed: "Vehicle access only. No hiking, horses, or bicycles.",
  },
];

const faq = [
  ["Do I have to register every time?", "No. Register once, then request gate access when needed. Access accounts are good for two years."],
  ["What is the cutoff time?", "Gate access requests must be submitted no later than 10:00 PM the evening before access."],
  ["Can I request more than one gate?", "No. Only one gate code per day. The access roads do not connect, so you must exit the same gate you entered."],
  ["Can I camp on the Ranch?", "No. There are no overnight stays on the Ranch."],
  ["Do I need 4WD?", "Yes. Road conditions vary, and true 4WD is required beyond the lower parking area."],
  ["Can I use an international phone number?", "The automated system cannot deliver gate codes internationally. International users must coordinate by email with operations@kapapalaranch.com."],
];

export default function ForestReserveAccessPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Information</p>
        <h2>Forest Reserve Access</h2>
        <span>
          Forest reserve access information, gate procedures, user rules, and
          hiker safety guidance for Kapāpala Ranch.
        </span>
      </div>

      <div className="account-management-layout">
        <div>
          <Card title="We Are a Working Ranch">
            <p className="muted-text">
              Kapāpala Ranch is an active cattle ranch. It is important that the
              Ranch knows who is on the property and where visitors may be during
              daily operations.
            </p>
            <div className="rule-list">
              <label><span>Do not approach cattle.</span></label>
              <label><span>Dogs must be kept in vehicles or leashed.</span></label>
              <label><span>Stay on access roads only.</span></label>
              <label><span>Do not drive, hike, or ride into other Ranch areas.</span></label>
            </div>
          </Card>

          <Card title="Access in a Nutshell">
            <div className="profile-detail-list">
              <div><span>Step 1</span><strong>Register for an Access Account.</strong></div>
              <div><span>Step 2</span><strong>Receive a 5-digit Access ID.</strong></div>
              <div><span>Step 3</span><strong>Request gate access by 10:00 PM the evening before.</strong></div>
              <div><span>Step 4</span><strong>Receive a text at gate opening time.</strong></div>
            </div>
          </Card>

          <Card title="Forest Reserve Gates">
            <div className="saved-item-list">
              {gates.map((gate) => (
                <div key={gate.name}>
                  <strong>{gate.name}</strong>
                  <span>{gate.hours}</span>
                  <span>{gate.location}</span>
                  <p className="muted-text">{gate.access}</p>
                  <p className="muted-text">{gate.allowed}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Requesting Forest Reserve Access">
            <div className="profile-detail-list">
              <div>
                <span>Register</span>
                <strong>
                  Complete the access account form and allow up to 3 days for review.
                </strong>
              </div>
              <div>
                <span>ID Review</span>
                <strong>
                  Submit a current government ID when requested. Check junk or spam folders if you do not receive the email.
                </strong>
              </div>
              <div>
                <span>Approval</span>
                <strong>
                  Once approved, a 5-digit Access ID will be texted to you.
                </strong>
              </div>
              <div>
                <span>Gate Request</span>
                <strong>
                  Submit your gate request by 10:00 PM the evening before access.
                </strong>
              </div>
              <div>
                <span>Gate Code</span>
                <strong>
                  Gate codes are texted at gate opening time: 4:30 AM for ʻĀinapō and 6:00 AM for other gates.
                </strong>
              </div>
            </div>
          </Card>

          <Card title="Overnight Hikers">
            <p className="muted-text">
              Overnight trips are permitted only with the proper State Halewai
              Cabin permit or NPS Mauna Loa Summit Cabin / backcountry permit.
              Gate codes may change daily, so request both entry and exit day
              access before your trip.
            </p>
            <div className="profile-detail-list">
              <div><span>48 Hours Before</span><strong>Register and obtain your Access ID.</strong></div>
              <div><span>Day Before</span><strong>Request gate codes for both entry and exit days by 10:00 PM.</strong></div>
              <div><span>Permits</span><strong>Include your cabin or backcountry permit number with your request.</strong></div>
              <div><span>Day Of Trip</span><strong>Sign in and out at the gate logbook.</strong></div>
              <div><span>Plan Changes</span><strong>Email operations@kapapalaranch.com if plans change.</strong></div>
            </div>
          </Card>
        </div>

        <div className="account-profile-column">
          <Card title="Use Agreement">
            <div className="rule-list">
              <label><span>Submit requests the day before access is desired.</span></label>
              <label><span>Sign in and out at the Ranch gate logbook.</span></label>
              <label><span>Enter and exit through the same gate.</span></label>
              <label><span>Stay on marked access roads at all times.</span></label>
              <label><span>Dogs must be secured until reaching the Forest Reserve.</span></label>
              <label><span>Leave gates as indicated by the Ranch.</span></label>
              <label><span>Parking is in the Forest Reserve only unless permission is granted.</span></label>
              <label><span>No hunting on the Ranch.</span></label>
              <label><span>No overnight stays on the Ranch.</span></label>
              <label><span>Do not share gate codes.</span></label>
            </div>
          </Card>

          <Card title="Hiker & Trail Safety Notice">
            <p className="muted-text">
              Do not approach ranch cattle. Cattle are larger and faster than
              people. Feral cattle, sheep, dogs, and pigs may also be
              encountered and should be given a wide berth.
            </p>
          </Card>

          <Card title="Forest Reserve Access Links">
            <div className="quick-action-button-grid">
              <Link className="button primary" href="/apply">
                Create Access Account
              </Link>
              <Link className="button secondary" href="/request-access">
                Request Gate Access
              </Link>
            </div>
            <p className="muted-text">
              Lost Access ID? Email operations@kapapalaranch.com.
            </p>
          </Card>

          <Card title="FAQ">
            <div className="mobile-form-stack">
              {faq.map(([question, answer]) => (
                <details key={question}>
                  <summary><strong>{question}</strong></summary>
                  <p className="muted-text">{answer}</p>
                </details>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}